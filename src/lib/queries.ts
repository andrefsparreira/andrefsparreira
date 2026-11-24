import { lerConfiguracao } from "./avenca-config";
import { montarLinha, type LinhaQuadro } from "./avenca-quadro";
import { sql } from "./db";
import { computeSummary, DEFAULT_VAT_RATE, historyWindow, monthlyRunRate } from "./pricing";
import type {
  Client,
  ClientStatus,
  DocMedium,
  DocOrganization,
  FeeLine,
  FeeYear,
  Inclusion,
  Periodicity,
  PricingRule,
  Proposal,
  ProposalSection,
  RetainerChoice,
  RetainerKind,
  RetainerParameter,
  RetainerSnapshot,
  RetainerValue,
  ServiceType,
} from "./types";

type ClientRow = {
  id: number;
  name: string;
  nif: string;
  legal_form: string;
  object: string;
  irc_regime: string;
  iva_regime: string;
  capital: number | null;
  partners: string;
  bank_accounts: number | null;
  expected_turnover: number | null;
  employees_ex_manager: number;
  situation_date: string | null;
  notes: string;
  logo_path: string | null;
};

function mapClient(row: ClientRow): Client {
  return {
    id: Number(row.id),
    name: row.name,
    nif: row.nif,
    legalForm: row.legal_form,
    object: row.object,
    ircRegime: row.irc_regime,
    ivaRegime: row.iva_regime,
    capital: row.capital,
    partners: row.partners,
    bankAccounts: row.bank_accounts,
    expectedTurnover: row.expected_turnover,
    employeesExManager: Number(row.employees_ex_manager ?? 0),
    situationDate: row.situation_date,
    notes: row.notes,
    logoPath: row.logo_path,
  };
}

export async function listClients(query: string): Promise<Client[]> {
  const q = `%${query.trim()}%`;
  const rows = await sql<ClientRow>(
    `SELECT * FROM clients
     WHERE name ILIKE $1 OR nif ILIKE $2
     ORDER BY name`,
    [q, q],
  );
  return rows.map(mapClient);
}

export async function getClient(id: number): Promise<Client | null> {
  const rows = await sql<ClientRow>("SELECT * FROM clients WHERE id = $1", [id]);
  return rows[0] ? mapClient(rows[0]) : null;
}

export async function getClientLogo(clientId: number): Promise<{ mime: string; data: string } | null> {
  const rows = await sql<{ mime: string; data: string }>(
    "SELECT mime, data FROM client_logos WHERE client_id = $1",
    [clientId],
  );
  return rows[0] ?? null;
}

type YearRow = {
  id: number;
  client_id: number;
  year: number;
  note: string;
  monthly_retainer: number | null;
  client_status: string;
  doc_organization: string;
  doc_count: number | null;
  doc_medium: string;
  turnover: number | null;
  manual_adjust: number | null;
  base_period: string | null;
  organization_level: number | null;
  accounting_level: number | null;
  approval_status: string | null;
  approved_retainer: number | null;
};

const YEAR_COLUMNS = `id, client_id, year, note, monthly_retainer, client_status, doc_organization,
  doc_count, doc_medium, turnover, manual_adjust, base_period,
  organization_level, accounting_level, approval_status, approved_retainer`;

function mapYear(row: YearRow): FeeYear {
  const status: ClientStatus = row.client_status === "novo" ? "novo" : "atual";
  const organization: DocOrganization =
    row.doc_organization === "alguma" ||
    row.doc_organization === "desorganizada" ||
    row.doc_organization === "muito_desorganizada"
      ? row.doc_organization
      : "organizada";
  const medium: DocMedium = row.doc_medium === "misto" || row.doc_medium === "fisico" ? row.doc_medium : "digital";
  return {
    id: Number(row.id),
    clientId: Number(row.client_id),
    year: Number(row.year),
    note: row.note,
    monthlyRetainer: row.monthly_retainer,
    clientStatus: status,
    docOrganization: organization,
    docCount: row.doc_count,
    docMedium: medium,
    turnover: row.turnover,
    manualAdjust: Number(row.manual_adjust ?? 0),
    basePeriod: row.base_period === "trimestral" ? "trimestral" : "mensal",
    organizationLevel: row.organization_level == null ? null : Number(row.organization_level),
    accountingLevel: row.accounting_level == null ? null : Number(row.accounting_level),
    approvalStatus: row.approval_status === "aprovada" || row.approval_status === "rejeitada" ? row.approval_status : "rascunho",
    approvedRetainer: row.approved_retainer == null ? null : Number(row.approved_retainer),
  };
}

export async function ensureFeeYears(clientId: number, years: number[]) {
  for (const year of years) {
    await sql(
      `INSERT INTO fee_years (client_id, year, note) VALUES ($1, $2, '')
       ON CONFLICT (client_id, year) DO NOTHING`,
      [clientId, year],
    );
  }
}

export async function listYears(clientId: number): Promise<FeeYear[]> {
  const rows = await sql<YearRow>(
    `SELECT ${YEAR_COLUMNS} FROM fee_years WHERE client_id = $1 ORDER BY year`,
    [clientId],
  );
  return rows.map(mapYear);
}

export async function getYear(clientId: number, year: number): Promise<FeeYear | null> {
  const rows = await sql<YearRow>(
    `SELECT ${YEAR_COLUMNS} FROM fee_years WHERE client_id = $1 AND year = $2`,
    [clientId, year],
  );
  return rows[0] ? mapYear(rows[0]) : null;
}

export function displayedMonthly(year: FeeYear, lines: FeeLine[]): number | null {
  const hasMonthly = lines.some(
    (line) => line.periodicity === "mensal" && line.inclusion === "valor" && !line.optional && line.unitValue != null,
  );
  if (hasMonthly) return monthlyRunRate(computeSummary(lines));
  return year.monthlyRetainer;
}

export async function retainerHistory(clientId: number, proposalYear: number): Promise<RetainerSnapshot[]> {
  const window = historyWindow(proposalYear);
  await ensureFeeYears(clientId, window);
  const years = await listYears(clientId);
  const snapshots: RetainerSnapshot[] = [];
  for (const value of window) {
    const row = years.find((item) => item.year === value);
    if (!row) {
      snapshots.push({ year: value, monthly: null, annual: null });
      continue;
    }
    const monthly = displayedMonthly(row, await getLines(row.id));
    snapshots.push({
      year: value,
      monthly,
      annual: monthly == null ? null : Math.round(monthly * 12 * 100) / 100,
    });
  }
  return snapshots;
}

type LineRow = {
  id: number;
  year_id: number;
  sort_order: number;
  type_code: string;
  description: string;
  periodicity: string;
  quantity: number | null;
  inclusion: string;
  optional: number;
  unit_value: number | null;
  manual: number;
  pricing_rule: string;
  notes: string;
};

function mapLine(row: LineRow): FeeLine {
  return {
    id: Number(row.id),
    yearId: Number(row.year_id),
    sortOrder: Number(row.sort_order),
    typeCode: row.type_code,
    description: row.description,
    periodicity: row.periodicity as Periodicity,
    quantity: row.quantity,
    inclusion: row.inclusion as Inclusion,
    optional: Number(row.optional) === 1,
    unitValue: row.unit_value,
    manual: Number(row.manual) === 1,
    pricingRule: row.pricing_rule as PricingRule,
    notes: row.notes,
  };
}

export async function getLines(yearId: number): Promise<FeeLine[]> {
  const rows = await sql<LineRow>(
    "SELECT * FROM fee_lines WHERE year_id = $1 ORDER BY sort_order, id",
    [yearId],
  );
  return rows.map(mapLine);
}

export async function listTypes(includeInactive = false): Promise<ServiceType[]> {
  const rows = await sql<{
    code: string;
    label: string;
    default_periodicity: string;
    pricing_rule: string;
    default_inclusion: string;
    default_optional: number;
    default_unit_value: number | null;
    sort_order: number;
    active: number;
  }>(
    `SELECT * FROM service_types ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort_order, label`,
  );
  return rows.map((row) => ({
    code: row.code,
    label: row.label,
    defaultPeriodicity: row.default_periodicity as Periodicity,
    pricingRule: row.pricing_rule as PricingRule,
    defaultInclusion: row.default_inclusion as Inclusion,
    defaultOptional: Number(row.default_optional) === 1,
    defaultUnitValue: row.default_unit_value,
    sortOrder: Number(row.sort_order),
    active: Number(row.active) === 1,
  }));
}

export async function getRetainerBase(): Promise<number> {
  const rows = await sql<{ value: string }>("SELECT value FROM settings WHERE key = 'retainer_base'");
  const amount = rows[0] ? Number(rows[0].value) : 150;
  return Number.isFinite(amount) ? amount : 150;
}

export async function listRetainerCatalog(): Promise<RetainerParameter[]> {
  const parameters = await sql<{ id: number; name: string; kind: string; sort_order: number }>(
    "SELECT id, name, kind, sort_order FROM retainer_parameters WHERE active = 1 ORDER BY sort_order, id",
  );
  const values = await sql<{
    id: number;
    parameter_id: number;
    label: string;
    amount: number;
    range_min: number | null;
    range_max: number | null;
    sort_order: number;
  }>("SELECT id, parameter_id, label, amount, range_min, range_max, sort_order FROM retainer_values ORDER BY sort_order, id");
  return parameters.map((parameter) => {
    const kind: RetainerKind = parameter.kind === "escalao" ? "escalao" : "opcao";
    const items: RetainerValue[] = values
      .filter((value) => Number(value.parameter_id) === Number(parameter.id))
      .map((value) => ({
        id: Number(value.id),
        parameterId: Number(value.parameter_id),
        label: value.label,
        amount: Number(value.amount),
        rangeMin: value.range_min,
        rangeMax: value.range_max,
        sortOrder: Number(value.sort_order),
      }));
    return {
      id: Number(parameter.id),
      name: parameter.name,
      kind,
      sortOrder: Number(parameter.sort_order),
      values: items,
    };
  });
}

export async function listYearChoices(yearId: number): Promise<RetainerChoice[]> {
  const rows = await sql<{ parameter_id: number; value_id: number | null; numeric_value: number | null }>(
    "SELECT parameter_id, value_id, numeric_value FROM fee_year_choices WHERE year_id = $1",
    [yearId],
  );
  return rows.map((row) => ({
    parameterId: Number(row.parameter_id),
    valueId: row.value_id == null ? null : Number(row.value_id),
    numeric: row.numeric_value,
  }));
}

export async function getAvencaConfig() {
  const rows = await sql<{ value: string }>("SELECT value FROM settings WHERE key = 'avenca_config'");
  return lerConfiguracao(rows[0]?.value);
}

export async function listQuadro(exercise: number): Promise<LinhaQuadro[]> {
  const config = await getAvencaConfig();
  const clients = await listClients("");
  const linhas: LinhaQuadro[] = [];
  for (const client of clients) {
    const atual = await getYear(client.id, exercise);
    const anterior = await getYear(client.id, exercise - 1);
    const avencaAnterior = anterior ? displayedMonthly(anterior, await getLines(anterior.id)) : null;
    linhas.push(
      montarLinha({
        clientId: client.id,
        name: client.name,
        year: exercise,
        atual: atual
          ? {
              faturacao: atual.turnover,
              documentos: atual.docCount,
              organizacao: atual.organizationLevel,
              contabilizacao: atual.accountingLevel,
              approvalStatus: atual.approvalStatus,
              approvedRetainer: atual.approvedRetainer,
            }
          : null,
        anterior: anterior
          ? {
              faturacao: anterior.turnover,
              documentos: anterior.docCount,
              organizacao: anterior.organizationLevel,
              contabilizacao: anterior.accountingLevel,
            }
          : null,
        avencaAnterior,
        config,
      }),
    );
  }
  return linhas;
}

export async function getVatRate(): Promise<number> {
  const rows = await sql<{ value: string }>("SELECT value FROM settings WHERE key = 'vat_rate'");
  const n = rows[0] ? Number(rows[0].value) : DEFAULT_VAT_RATE;
  return Number.isFinite(n) ? n : DEFAULT_VAT_RATE;
}

type ProposalRow = {
  id: number;
  client_id: number;
  year: number;
  proposal_date: string;
  title: string;
  sections_json: string;
  updated_at: string | Date;
};

function mapProposal(row: ProposalRow): Proposal {
  const updated = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);
  return {
    id: Number(row.id),
    clientId: Number(row.client_id),
    year: Number(row.year),
    proposalDate: row.proposal_date,
    title: row.title,
    sections: JSON.parse(row.sections_json) as ProposalSection[],
    updatedAt: updated,
  };
}

export async function findProposal(clientId: number, year: number): Promise<Proposal | null> {
  const rows = await sql<ProposalRow>("SELECT * FROM proposals WHERE client_id = $1 AND year = $2", [clientId, year]);
  return rows[0] ? mapProposal(rows[0]) : null;
}

export async function getProposal(id: number): Promise<Proposal | null> {
  const rows = await sql<ProposalRow>("SELECT * FROM proposals WHERE id = $1", [id]);
  return rows[0] ? mapProposal(rows[0]) : null;
}
