"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validarConfiguracao } from "@/lib/avenca-config";
import { calcularRevisaoAvenca, type ConfiguracaoAvencas, type DadosAnuais } from "@/lib/avenca-motor";
import { sql, withTransaction, type Query } from "@/lib/db";
import { modeloLinhas } from "@/lib/example";
import { parseDecimal, todayISO } from "@/lib/format";
import { computeBaseRetainer, historyWindow } from "@/lib/pricing";
import { displayedMonthly, ensureFeeYears, getAvencaConfig, getClient, getLines, getYear, listRetainerCatalog } from "@/lib/queries";
import { insertDrafts } from "@/lib/seed";
import { buildProposalSections } from "@/lib/template";
import type {
  BasePeriod,
  ClientStatus,
  Inclusion,
  LineDraft,
  Periodicity,
  PricingRule,
  ProposalSection,
  RetainerChoice,
  RetainerKind,
} from "@/lib/types";
import { requireViewer } from "@/lib/viewer";

const PERIODS = new Set<Periodicity>(["mensal", "trimestral", "anual", "one_shot"]);
const INCLUSIONS = new Set<Inclusion>(["valor", "incluido", "sob_consulta"]);
const RULES = new Set<PricingRule>([
  "fixed",
  "payroll",
  "per_occurrence",
  "ru_tier",
  "included",
  "consultation",
]);

const LINE_INSERT = `
  INSERT INTO fee_lines (
    year_id, sort_order, type_code, description, periodicity, quantity,
    inclusion, optional, unit_value, manual, pricing_rule, notes
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
`;

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optionalNumber(formData: FormData, key: string): number | null {
  return parseDecimal(text(formData, key));
}

function slug(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return base || `tipo_${Date.now()}`;
}

async function gate() {
  if (!(await requireViewer())) redirect("/");
}

export async function createClient(formData: FormData) {
  await gate();
  const name = text(formData, "name");
  if (!name) redirect("/clientes/novo?erro=nome");
  const nif = text(formData, "nif");
  if (nif && !/^\d{9}$/.test(nif)) redirect("/clientes/novo?erro=nif");

  const inserted = await sql<{ id: number }>(
    `INSERT INTO clients (
      name, nif, legal_form, object, irc_regime, iva_regime, capital, partners,
      bank_accounts, expected_turnover, employees_ex_manager, situation_date, notes, logo_path
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NULL)
    RETURNING id`,
    [
      name,
      nif,
      text(formData, "legalForm"),
      text(formData, "object"),
      text(formData, "ircRegime"),
      text(formData, "ivaRegime"),
      optionalNumber(formData, "capital"),
      text(formData, "partners"),
      optionalNumber(formData, "bankAccounts"),
      optionalNumber(formData, "expectedTurnover"),
      optionalNumber(formData, "employeesExManager") ?? 0,
      text(formData, "situationDate") || null,
      text(formData, "notes"),
    ],
  );
  const id = Number(inserted[0]?.id);
  await ensureFeeYears(id, [...historyWindow(2027), 2027]);
  await sql("UPDATE fee_years SET note = $1 WHERE client_id = $2 AND year = 2027", [
    "Ano alvo da proposta.",
    id,
  ]);
  revalidatePath("/");
  redirect(`/clientes/${id}?ok=criado`);
}

export async function updateClient(formData: FormData) {
  await gate();
  const id = Number(formData.get("id"));
  const name = text(formData, "name");
  if (!name) redirect(`/clientes/${id}?erro=nome`);
  const nif = text(formData, "nif");
  if (nif && !/^\d{9}$/.test(nif)) redirect(`/clientes/${id}?erro=nif`);
  await sql(
    `UPDATE clients SET
      name = $1, nif = $2, legal_form = $3, object = $4, irc_regime = $5, iva_regime = $6,
      capital = $7, partners = $8, bank_accounts = $9, expected_turnover = $10,
      employees_ex_manager = $11, situation_date = $12, notes = $13
     WHERE id = $14`,
    [
      name,
      nif,
      text(formData, "legalForm"),
      text(formData, "object"),
      text(formData, "ircRegime"),
      text(formData, "ivaRegime"),
      optionalNumber(formData, "capital"),
      text(formData, "partners"),
      optionalNumber(formData, "bankAccounts"),
      optionalNumber(formData, "expectedTurnover"),
      optionalNumber(formData, "employeesExManager") ?? 0,
      text(formData, "situationDate") || null,
      text(formData, "notes"),
      id,
    ],
  );
  revalidatePath("/");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}?ok=ficha`);
}

function imageMime(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}

export async function saveCoverPhoto(formData: FormData) {
  await gate();
  const clientId = Number(formData.get("clientId"));
  const proposalId = Number(formData.get("proposalId"));
  const back = Number.isInteger(proposalId) && proposalId > 0 ? `/propostas/${proposalId}` : `/clientes/${clientId}`;
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) redirect(`${back}?erro=foto`);
  if (file.size > 4 * 1024 * 1024) redirect(`${back}?erro=foto`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = imageMime(bytes);
  if (!mime) redirect(`${back}?erro=foto`);
  await sql(
    `INSERT INTO client_logos (client_id, mime, data) VALUES ($1, $2, $3)
     ON CONFLICT (client_id) DO UPDATE SET mime = excluded.mime, data = excluded.data`,
    [clientId, mime, bytes.toString("base64")],
  );
  await sql("UPDATE clients SET logo_path = $1 WHERE id = $2", [`/api/clientes/${clientId}/logo`, clientId]);
  revalidatePath(`/clientes/${clientId}`);
  if (proposalId) revalidatePath(`/propostas/${proposalId}`);
  redirect(`${back}?ok=foto`);
}

export async function deleteClient(formData: FormData) {
  await gate();
  const id = Number(formData.get("id"));
  await sql("DELETE FROM clients WHERE id = $1", [id]);
  revalidatePath("/");
  redirect("/");
}

export async function createYear(formData: FormData) {
  await gate();
  const clientId = Number(formData.get("clientId"));
  const year = Number(formData.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    redirect(`/clientes/${clientId}?erro=ano`);
  }
  const existing = await sql<{ id: number }>("SELECT id FROM fee_years WHERE client_id = $1 AND year = $2", [
    clientId,
    year,
  ]);
  if (existing[0]) redirect(`/clientes/${clientId}?ano=${year}`);

  const created = await sql<{ id: number }>(
    "INSERT INTO fee_years (client_id, year, note) VALUES ($1, $2, $3) RETURNING id",
    [clientId, year, text(formData, "note")],
  );
  const yearId = Number(created[0]?.id);
  const copyFrom = Number(formData.get("copyFrom"));
  if (copyFrom) {
    const lines = await getLines(copyFrom);
    for (const [index, line] of lines.entries()) {
      await sql(LINE_INSERT, [
        yearId,
        index + 1,
        line.typeCode,
        line.description,
        line.periodicity,
        line.quantity,
        line.inclusion,
        line.optional ? 1 : 0,
        line.unitValue,
        line.manual ? 1 : 0,
        line.pricingRule,
        line.notes,
      ]);
    }
  }
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?ano=${year}`);
}

export async function saveYearLines(input: {
  yearId: number;
  vatRate: number;
  lines: LineDraft[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireViewer())) return { ok: false, error: "Sessão em falta." };
  const yearRows = await sql<{ id: number; client_id: number }>(
    "SELECT id, client_id FROM fee_years WHERE id = $1",
    [input.yearId],
  );
  const yearRow = yearRows[0];
  if (!yearRow) return { ok: false, error: "Ano não encontrado." };
  if (!Number.isFinite(input.vatRate) || input.vatRate < 0 || input.vatRate > 1) {
    return { ok: false, error: "A taxa de IVA tem de estar entre 0% e 100%." };
  }

  await withTransaction(async (query) => {
    await query(
      `INSERT INTO settings (key, value) VALUES ('vat_rate', $1)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [String(input.vatRate)],
    );
    await query("DELETE FROM fee_lines WHERE year_id = $1", [input.yearId]);
    let order = 1;
    for (const line of input.lines) {
      if (!line.description.trim()) continue;
      await query(LINE_INSERT, [
        input.yearId,
        order,
        line.typeCode || "outros",
        line.description.trim(),
        PERIODS.has(line.periodicity) ? line.periodicity : "mensal",
        line.quantity,
        INCLUSIONS.has(line.inclusion) ? line.inclusion : "valor",
        line.optional ? 1 : 0,
        line.unitValue,
        line.manual ? 1 : 0,
        RULES.has(line.pricingRule) ? line.pricingRule : "fixed",
        line.notes?.trim() ?? "",
      ]);
      order += 1;
    }
  });
  revalidatePath(`/clientes/${yearRow.client_id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function loadModelLines(formData: FormData) {
  await gate();
  const clientId = Number(formData.get("clientId"));
  const year = Number(formData.get("year"));
  const client = await getClient(clientId);
  const feeYear = client ? await getYear(clientId, year) : null;
  if (!client || !feeYear) redirect(`/clientes/${clientId}`);
  const lines = modeloLinhas({ exampleValues: false, employees: client.employeesExManager });
  await withTransaction(async (query) => {
    await query("DELETE FROM fee_lines WHERE year_id = $1", [feeYear.id]);
    await insertDrafts(query, feeYear.id, lines);
  });
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?ano=${year}&ok=modelo`);
}

export async function saveServiceType(formData: FormData) {
  await gate();
  const label = text(formData, "label");
  if (!label) redirect("/tabela?erro=tipo");
  const codeInput = text(formData, "code");
  const code = codeInput || slug(label);
  const periodicity = text(formData, "periodicity");
  const rule = text(formData, "pricingRule");
  const inclusion = text(formData, "inclusion");
  const maxRows = await sql<{ n: number }>("SELECT COALESCE(MAX(sort_order), 0)::int AS n FROM service_types");
  const sort = Number(maxRows[0]?.n ?? 0) + 10;
  const existing = codeInput
    ? await sql<{ sort_order: number }>("SELECT sort_order FROM service_types WHERE code = $1", [code])
    : [];
  await sql(
    `INSERT INTO service_types (
      code, label, default_periodicity, pricing_rule, default_inclusion,
      default_optional, default_unit_value, sort_order, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)
    ON CONFLICT (code) DO UPDATE SET
      label = excluded.label,
      default_periodicity = excluded.default_periodicity,
      pricing_rule = excluded.pricing_rule,
      default_inclusion = excluded.default_inclusion,
      default_optional = excluded.default_optional,
      default_unit_value = excluded.default_unit_value,
      active = 1`,
    [
      code,
      label,
      PERIODS.has(periodicity as Periodicity) ? periodicity : "mensal",
      RULES.has(rule as PricingRule) ? rule : "fixed",
      INCLUSIONS.has(inclusion as Inclusion) ? inclusion : "valor",
      formData.get("optional") ? 1 : 0,
      optionalNumber(formData, "unitValue"),
      existing[0] ? Number(existing[0].sort_order) : sort,
    ],
  );
  revalidatePath("/tabela");
  redirect("/tabela?ok=tipo");
}

export async function deactivateServiceType(formData: FormData) {
  await gate();
  await sql("UPDATE service_types SET active = 0 WHERE code = $1", [text(formData, "code")]);
  revalidatePath("/tabela");
  redirect("/tabela");
}

export async function openProposal(formData: FormData) {
  await gate();
  const clientId = Number(formData.get("clientId"));
  const year = Number(formData.get("year"));
  const client = await getClient(clientId);
  if (!client) redirect("/");
  const existing = await sql<{ id: number }>("SELECT id FROM proposals WHERE client_id = $1 AND year = $2", [
    clientId,
    year,
  ]);
  if (existing[0]) redirect(`/propostas/${existing[0].id}`);
  const sections = buildProposalSections(client, year);
  const result = await sql<{ id: number }>(
    `INSERT INTO proposals (client_id, year, proposal_date, title, sections_json)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [clientId, year, todayISO(), `Proposta de prestação de serviços ${year}`, JSON.stringify(sections)],
  );
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/propostas/${Number(result[0]?.id)}`);
}

export async function saveProposal(input: {
  id: number;
  proposalDate: string;
  sections: ProposalSection[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireViewer())) return { ok: false, error: "Sessão em falta." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.proposalDate)) {
    return { ok: false, error: "Indique a data da proposta." };
  }
  await sql(
    `UPDATE proposals
     SET proposal_date = $1, sections_json = $2, updated_at = now()
     WHERE id = $3`,
    [input.proposalDate, JSON.stringify(input.sections), input.id],
  );
  revalidatePath(`/propostas/${input.id}`);
  return { ok: true };
}

const STATUSES = new Set<ClientStatus>(["atual", "novo"]);
const PERIODS_BASE = new Set<BasePeriod>(["mensal", "trimestral"]);
const KINDS = new Set<RetainerKind>(["opcao", "escalao"]);

async function upsertMonthlyLine(
  query: Query,
  yearId: number,
  monthly: number,
  note: string,
  createIfMissing: boolean,
) {
  const rows = await query<{ id: number }>(
    `SELECT id FROM fee_lines
     WHERE year_id = $1 AND periodicity = 'mensal' AND inclusion = 'valor' AND optional = 0
     ORDER BY sort_order, id
     LIMIT 1`,
    [yearId],
  );
  const existing = rows[0];
  if (existing) {
    await query("UPDATE fee_lines SET unit_value = $1, manual = 1, notes = $2 WHERE id = $3", [
      monthly,
      note,
      existing.id,
    ]);
    return;
  }
  if (!createIfMissing) return;
  await query(LINE_INSERT, [
    yearId,
    0,
    "mensal",
    "Responsabilidade CC e execução dos serviços",
    "mensal",
    null,
    "valor",
    0,
    monthly,
    1,
    "fixed",
    note,
  ]);
}

async function upsertBaseLine(query: Query, yearId: number, amount: number, period: BasePeriod, note: string) {
  const rows = await query<{ id: number }>(
    `SELECT id FROM fee_lines
     WHERE year_id = $1 AND optional = 0 AND inclusion = 'valor' AND periodicity IN ('mensal', 'trimestral')
     ORDER BY CASE
       WHEN notes LIKE 'Calculada%' OR description ILIKE '%responsabilidade%' THEN 0
       ELSE 1
     END, sort_order, id
     LIMIT 1`,
    [yearId],
  );
  const typeCode = period === "trimestral" ? "trimestral" : "mensal";
  const existing = rows[0];
  if (existing) {
    await query(
      "UPDATE fee_lines SET unit_value = $1, manual = 1, notes = $2, periodicity = $3, type_code = $4 WHERE id = $5",
      [amount, note, period, typeCode, existing.id],
    );
    return;
  }
  await query(LINE_INSERT, [
    yearId,
    0,
    typeCode,
    "Responsabilidade CC e execução dos serviços",
    period,
    null,
    "valor",
    0,
    amount,
    1,
    "fixed",
    note,
  ]);
}

export async function saveRetainerCatalog(input: {
  baseAmount: number;
  parameters: {
    id: number | null;
    name: string;
    kind: RetainerKind;
    values: {
      id: number | null;
      label: string;
      amount: number;
      rangeMin: number | null;
      rangeMax: number | null;
    }[];
  }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireViewer())) return { ok: false, error: "Sessão em falta." };
  if (!Number.isFinite(input.baseAmount) || input.baseAmount < 0) {
    return { ok: false, error: "A avença base tem de ser zero ou positiva." };
  }
  if (input.parameters.length === 0) return { ok: false, error: "Indique pelo menos um parâmetro." };
  for (const parameter of input.parameters) {
    if (!parameter.name.trim()) return { ok: false, error: "Cada parâmetro precisa de um nome." };
    if (!KINDS.has(parameter.kind)) return { ok: false, error: "Tipo de parâmetro inválido." };
    for (const value of parameter.values) {
      if (!value.label.trim()) return { ok: false, error: `Falta o nome de um valor em «${parameter.name}».` };
      if (!Number.isFinite(value.amount)) return { ok: false, error: `O valor de «${value.label}» não é um número.` };
    }
  }

  try {
    await withTransaction(async (query) => {
    await query(
      `INSERT INTO settings (key, value) VALUES ('retainer_base', $1)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      [String(input.baseAmount)],
    );
    const keptParameters: number[] = [];
    for (const [parameterIndex, parameter] of input.parameters.entries()) {
      let parameterId = parameter.id ?? 0;
      if (parameterId) {
        await query("UPDATE retainer_parameters SET name = $1, kind = $2, sort_order = $3, active = 1 WHERE id = $4", [
          parameter.name.trim(),
          parameter.kind,
          (parameterIndex + 1) * 10,
          parameterId,
        ]);
      } else {
        const inserted = await query<{ id: number }>(
          "INSERT INTO retainer_parameters (name, kind, sort_order) VALUES ($1, $2, $3) RETURNING id",
          [parameter.name.trim(), parameter.kind, (parameterIndex + 1) * 10],
        );
        parameterId = Number(inserted[0]?.id);
      }
      keptParameters.push(parameterId);
      const keptValues: number[] = [];
      for (const [valueIndex, value] of parameter.values.entries()) {
        let valueId = value.id ?? 0;
        if (valueId) {
          await query(
            `UPDATE retainer_values
             SET label = $1, amount = $2, range_min = $3, range_max = $4, sort_order = $5, parameter_id = $6
             WHERE id = $7`,
            [value.label.trim(), value.amount, value.rangeMin, value.rangeMax, (valueIndex + 1) * 10, parameterId, valueId],
          );
        } else {
          const inserted = await query<{ id: number }>(
            `INSERT INTO retainer_values (parameter_id, label, amount, range_min, range_max, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [parameterId, value.label.trim(), value.amount, value.rangeMin, value.rangeMax, (valueIndex + 1) * 10],
          );
          valueId = Number(inserted[0]?.id);
        }
        keptValues.push(valueId);
      }
      if (keptValues.length === 0) {
        await query("DELETE FROM retainer_values WHERE parameter_id = $1", [parameterId]);
      } else {
        await query(
          `DELETE FROM retainer_values WHERE parameter_id = $1 AND NOT (id = ANY($2::int[]))`,
          [parameterId, keptValues],
        );
      }
    }
    await query("DELETE FROM retainer_parameters WHERE NOT (id = ANY($1::int[]))", [keptParameters]);
  });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Erro ao gravar.";
    return { ok: false, error: detail };
  }
  revalidatePath("/tabela");
  revalidatePath("/parametros");
  revalidatePath("/");
  return { ok: true };
}

export async function saveRetainerAssessment(input: {
  yearId: number;
  clientStatus: ClientStatus;
  period: BasePeriod;
  manualAdjust: number;
  selections: RetainerChoice[];
}): Promise<{ ok: true; amount: number; period: BasePeriod } | { ok: false; error: string }> {
  if (!(await requireViewer())) return { ok: false, error: "Sessão em falta." };
  const yearRows = await sql<{ id: number; client_id: number; year: number }>(
    "SELECT id, client_id, year FROM fee_years WHERE id = $1",
    [input.yearId],
  );
  const yearRow = yearRows[0];
  if (!yearRow) return { ok: false, error: "Ano não encontrado." };
  if (!STATUSES.has(input.clientStatus) || !PERIODS_BASE.has(input.period)) {
    return { ok: false, error: "Parâmetros inválidos." };
  }
  if (!Number.isFinite(input.manualAdjust)) return { ok: false, error: "O ajuste manual não é um número." };
  const catalog = await listRetainerCatalog();
  const baseRows = await sql<{ value: string }>("SELECT value FROM settings WHERE key = 'retainer_base'");
  const baseAmount = baseRows[0] ? Number(baseRows[0].value) : 150;
  for (const selection of input.selections) {
    const parameter = catalog.find((item) => item.id === selection.parameterId);
    if (!parameter) return { ok: false, error: "Há um parâmetro que já não existe. Actualize a página." };
    if (parameter.kind === "escalao" && selection.numeric != null && (!Number.isFinite(selection.numeric) || selection.numeric < 0)) {
      return { ok: false, error: `O valor de «${parameter.name}» tem de ser zero ou positivo.` };
    }
  }
  const quote = computeBaseRetainer({
    baseAmount: Number.isFinite(baseAmount) ? baseAmount : 150,
    period: input.period,
    parameters: catalog,
    selections: input.selections,
    manualAdjust: input.manualAdjust,
  });
  const note = `Avença base ${input.period === "trimestral" ? "trimestral" : "mensal"}, calculada sobre ${quote.base.toFixed(2).replace(".", ",")} €: ${quote.parts
    .map((part) => `${part.label} ${part.amount >= 0 ? "+" : ""}${part.amount.toFixed(2).replace(".", ",")} €`)
    .join("; ")}.`;

  await withTransaction(async (query) => {
    await query(
      `UPDATE fee_years SET monthly_retainer = $1, client_status = $2, manual_adjust = $3, base_period = $4 WHERE id = $5`,
      [quote.periodAmount, input.clientStatus, input.manualAdjust, input.period, input.yearId],
    );
    await query("DELETE FROM fee_year_choices WHERE year_id = $1", [input.yearId]);
    for (const selection of input.selections) {
      await query(
        `INSERT INTO fee_year_choices (year_id, parameter_id, value_id, numeric_value) VALUES ($1, $2, $3, $4)`,
        [input.yearId, selection.parameterId, selection.valueId, selection.numeric],
      );
    }
    await upsertBaseLine(query, input.yearId, quote.periodAmount, input.period, note);
  });
  revalidatePath(`/clientes/${yearRow.client_id}`);
  revalidatePath("/");
  return { ok: true, amount: quote.periodAmount, period: input.period };
}

function organizacaoGuardada(nivel: number): string {
  if (nivel <= 2) return "organizada";
  if (nivel <= 4) return "alguma";
  if (nivel === 5) return "desorganizada";
  return "muito_desorganizada";
}

function validarAtividade(dados: DadosAnuais, rotulo: string): string | null {
  try {
    calcularRevisaoAvenca(1, dados, dados);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dados inválidos.";
    if (message.includes("positiva")) return null;
    return `${rotulo}: ${message}`;
  }
  return null;
}

async function gravarAtividade(query: Query, clientId: number, year: number, dados: DadosAnuais): Promise<number> {
  const existing = await query<{ id: number }>(
    "SELECT id FROM fee_years WHERE client_id = $1 AND year = $2",
    [clientId, year],
  );
  let yearId = existing[0] ? Number(existing[0].id) : 0;
  if (!yearId) {
    const created = await query<{ id: number }>(
      "INSERT INTO fee_years (client_id, year, note) VALUES ($1, $2, '') RETURNING id",
      [clientId, year],
    );
    yearId = Number(created[0]?.id);
  }
  await query(
    `UPDATE fee_years SET
      turnover = $1, doc_count = $2, organization_level = $3, accounting_level = $4, doc_organization = $5
     WHERE id = $6`,
    [dados.faturacao, dados.documentos, dados.organizacao, dados.contabilizacao, organizacaoGuardada(dados.organizacao), yearId],
  );
  return yearId;
}

export async function saveAvaliacao(input: {
  clientId: number;
  year: number;
  atual: DadosAnuais;
  anterior: DadosAnuais;
  decisao: "guardar" | "aprovar" | "rejeitar";
}): Promise<{ ok: true; amount?: number } | { ok: false; error: string }> {
  if (!(await requireViewer())) return { ok: false, error: "Sessão em falta." };
  const client = await getClient(input.clientId);
  if (!client) return { ok: false, error: "Cliente não encontrado." };
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) {
    return { ok: false, error: "Indique um ano entre 2000 e 2100." };
  }
  const erroAtual = validarAtividade(input.atual, String(input.year));
  if (erroAtual) return { ok: false, error: erroAtual };
  const erroAnterior = validarAtividade(input.anterior, String(input.year - 1));
  if (erroAnterior) return { ok: false, error: erroAnterior };

  const config = await getAvencaConfig();
  const anteriorAno = await getYear(input.clientId, input.year - 1);
  const avencaAnterior = anteriorAno ? displayedMonthly(anteriorAno, await getLines(anteriorAno.id)) : null;
  let revisao: ReturnType<typeof calcularRevisaoAvenca> | null = null;
  if (input.decisao === "aprovar") {
    if (avencaAnterior == null || avencaAnterior <= 0) {
      return { ok: false, error: "Indique primeiro a avença praticada no ano anterior." };
    }
    revisao = calcularRevisaoAvenca(avencaAnterior, input.anterior, input.atual, config);
    if (revisao.avencaProposta == null || revisao.avencaArredondada == null) {
      return { ok: false, error: revisao.motivo ?? "Esta proposta fica para revisão manual, sem valor automático." };
    }
  }

  const amount = revisao && revisao.avencaArredondada != null ? revisao.avencaArredondada : null;
  await withTransaction(async (query) => {
    await gravarAtividade(query, input.clientId, input.year - 1, input.anterior);
    const yearId = await gravarAtividade(query, input.clientId, input.year, input.atual);
    if (input.decisao === "aprovar" && amount != null) {
      const note = `Avença aprovada para ${input.year}: ${amount.toFixed(2).replace(".", ",")} € por mês.`;
      await query(
        `UPDATE fee_years SET approval_status = 'aprovada', approved_retainer = $1, monthly_retainer = $1 WHERE id = $2`,
        [amount, yearId],
      );
      await upsertBaseLine(query, yearId, amount, "mensal", note);
      return;
    }
    if (input.decisao === "rejeitar") {
      await query("UPDATE fee_years SET approval_status = 'rejeitada' WHERE id = $1", [yearId]);
      return;
    }
    await query("UPDATE fee_years SET approval_status = 'rascunho', approved_retainer = NULL WHERE id = $1", [yearId]);
  });

  revalidatePath(`/clientes/${input.clientId}`);
  revalidatePath("/avencas");
  revalidatePath("/");
  const proposals = await sql<{ id: number }>(
    "SELECT id FROM proposals WHERE client_id = $1 AND year = $2",
    [input.clientId, input.year],
  );
  if (proposals[0]) revalidatePath(`/propostas/${Number(proposals[0].id)}`);
  return amount == null ? { ok: true } : { ok: true, amount };
}

export async function saveAvencaConfig(input: ConfiguracaoAvencas): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireViewer())) return { ok: false, error: "Sessão em falta." };
  let config: ConfiguracaoAvencas;
  try {
    config = validarConfiguracao(input);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Configuração inválida." };
  }
  await sql(
    `INSERT INTO settings (key, value) VALUES ('avenca_config', $1)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [JSON.stringify(config)],
  );
  revalidatePath("/parametros");
  revalidatePath("/avencas");
  revalidatePath("/");
  return { ok: true };
}

export async function saveRetainerHistory(input: {
  clientId: number;
  proposalYear: number;
  rows: { year: number; monthly: number | null }[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await requireViewer())) return { ok: false, error: "Sessão em falta." };
  const client = await getClient(input.clientId);
  if (!client) return { ok: false, error: "Cliente não encontrado." };
  const allowed = new Set(historyWindow(input.proposalYear));
  for (const row of input.rows) {
    if (!allowed.has(row.year)) return { ok: false, error: "Ano fora do histórico." };
    if (row.monthly != null && (!Number.isFinite(row.monthly) || row.monthly < 0)) {
      return { ok: false, error: `A avença de ${row.year} tem de ser zero ou positiva.` };
    }
  }
  await withTransaction(async (query) => {
    for (const row of input.rows) {
      const existing = await query<{ id: number }>(
        "SELECT id FROM fee_years WHERE client_id = $1 AND year = $2",
        [input.clientId, row.year],
      );
      let yearId = existing[0] ? Number(existing[0].id) : 0;
      if (!yearId) {
        const created = await query<{ id: number }>(
          "INSERT INTO fee_years (client_id, year, note, monthly_retainer) VALUES ($1, $2, $3, $4) RETURNING id",
          [input.clientId, row.year, "Avença mensal já praticada.", row.monthly],
        );
        yearId = Number(created[0]?.id);
      } else {
        await query("UPDATE fee_years SET monthly_retainer = $1 WHERE id = $2", [row.monthly, yearId]);
      }
      if (row.monthly != null) {
        await upsertMonthlyLine(query, yearId, row.monthly, "Valor lançado no histórico de avenças.", false);
      }
    }
  });
  revalidatePath(`/clientes/${input.clientId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function resetProposalTexts(formData: FormData) {
  await gate();
  const id = Number(formData.get("id"));
  const rows = await sql<{ client_id: number; year: number }>(
    "SELECT client_id, year FROM proposals WHERE id = $1",
    [id],
  );
  const row = rows[0];
  if (!row) redirect("/");
  const client = await getClient(Number(row.client_id));
  if (!client) redirect("/");
  const sections = buildProposalSections(client, Number(row.year));
  await sql("UPDATE proposals SET sections_json = $1, updated_at = now() WHERE id = $2", [
    JSON.stringify(sections),
    id,
  ]);
  revalidatePath(`/propostas/${id}`);
  redirect(`/propostas/${id}?editar=1&ok=textos`);
}
