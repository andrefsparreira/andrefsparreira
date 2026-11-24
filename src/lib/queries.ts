import { sql } from "./db";
import { DEFAULT_VAT_RATE } from "./pricing";
import type {
  Client,
  FeeLine,
  FeeYear,
  Inclusion,
  Periodicity,
  PricingRule,
  Proposal,
  ProposalSection,
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

export async function listYears(clientId: number): Promise<FeeYear[]> {
  const rows = await sql<{ id: number; client_id: number; year: number; note: string }>(
    "SELECT id, client_id, year, note FROM fee_years WHERE client_id = $1 ORDER BY year",
    [clientId],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    clientId: Number(row.client_id),
    year: Number(row.year),
    note: row.note,
  }));
}

export async function getYear(clientId: number, year: number): Promise<FeeYear | null> {
  const rows = await sql<{ id: number; client_id: number; year: number; note: string }>(
    "SELECT id, client_id, year, note FROM fee_years WHERE client_id = $1 AND year = $2",
    [clientId, year],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: Number(row.id), clientId: Number(row.client_id), year: Number(row.year), note: row.note };
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
