"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql, withTransaction } from "@/lib/db";
import { modeloLinhas } from "@/lib/example";
import { parseDecimal, todayISO } from "@/lib/format";
import { getClient, getLines, getYear } from "@/lib/queries";
import { insertDrafts } from "@/lib/seed";
import { buildProposalSections } from "@/lib/template";
import type { Inclusion, LineDraft, Periodicity, PricingRule, ProposalSection } from "@/lib/types";
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
  await sql("INSERT INTO fee_years (client_id, year, note) VALUES ($1, 2027, $2)", [id, "Ano alvo da proposta."]);
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
