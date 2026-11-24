import { getDb } from "./db";
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
    id: row.id,
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
    employeesExManager: row.employees_ex_manager,
    situationDate: row.situation_date,
    notes: row.notes,
    logoPath: row.logo_path,
  };
}

export function listClients(query: string): Client[] {
  const q = `%${query.trim()}%`;
  const rows = getDb()
    .prepare(
      `SELECT * FROM clients
       WHERE name LIKE ? COLLATE NOCASE OR nif LIKE ?
       ORDER BY name COLLATE NOCASE`,
    )
    .all(q, q) as ClientRow[];
  return rows.map(mapClient);
}

export function getClient(id: number): Client | null {
  const row = getDb().prepare("SELECT * FROM clients WHERE id = ?").get(id) as ClientRow | undefined;
  return row ? mapClient(row) : null;
}

export function listYears(clientId: number): FeeYear[] {
  const rows = getDb()
    .prepare("SELECT id, client_id, year, note FROM fee_years WHERE client_id = ? ORDER BY year")
    .all(clientId) as { id: number; client_id: number; year: number; note: string }[];
  return rows.map((row) => ({
    id: row.id,
    clientId: row.client_id,
    year: row.year,
    note: row.note,
  }));
}

export function getYear(clientId: number, year: number): FeeYear | null {
  const row = getDb()
    .prepare("SELECT id, client_id, year, note FROM fee_years WHERE client_id = ? AND year = ?")
    .get(clientId, year) as { id: number; client_id: number; year: number; note: string } | undefined;
  if (!row) return null;
  return { id: row.id, clientId: row.client_id, year: row.year, note: row.note };
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
    id: row.id,
    yearId: row.year_id,
    sortOrder: row.sort_order,
    typeCode: row.type_code,
    description: row.description,
    periodicity: row.periodicity as Periodicity,
    quantity: row.quantity,
    inclusion: row.inclusion as Inclusion,
    optional: row.optional === 1,
    unitValue: row.unit_value,
    manual: row.manual === 1,
    pricingRule: row.pricing_rule as PricingRule,
    notes: row.notes,
  };
}

export function getLines(yearId: number): FeeLine[] {
  const rows = getDb()
    .prepare("SELECT * FROM fee_lines WHERE year_id = ? ORDER BY sort_order, id")
    .all(yearId) as LineRow[];
  return rows.map(mapLine);
}

export function listTypes(includeInactive = false): ServiceType[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM service_types ${includeInactive ? "" : "WHERE active = 1"} ORDER BY sort_order, label`,
    )
    .all() as {
    code: string;
    label: string;
    default_periodicity: string;
    pricing_rule: string;
    default_inclusion: string;
    default_optional: number;
    default_unit_value: number | null;
    sort_order: number;
    active: number;
  }[];
  return rows.map((row) => ({
    code: row.code,
    label: row.label,
    defaultPeriodicity: row.default_periodicity as Periodicity,
    pricingRule: row.pricing_rule as PricingRule,
    defaultInclusion: row.default_inclusion as Inclusion,
    defaultOptional: row.default_optional === 1,
    defaultUnitValue: row.default_unit_value,
    sortOrder: row.sort_order,
    active: row.active === 1,
  }));
}

export function getVatRate(): number {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'vat_rate'").get() as
    | { value: string }
    | undefined;
  const n = row ? Number(row.value) : DEFAULT_VAT_RATE;
  return Number.isFinite(n) ? n : DEFAULT_VAT_RATE;
}

export function setVatRate(rate: number) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES ('vat_rate', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(String(rate));
}

type ProposalRow = {
  id: number;
  client_id: number;
  year: number;
  proposal_date: string;
  title: string;
  sections_json: string;
  updated_at: string;
};

function mapProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    clientId: row.client_id,
    year: row.year,
    proposalDate: row.proposal_date,
    title: row.title,
    sections: JSON.parse(row.sections_json) as ProposalSection[],
    updatedAt: row.updated_at,
  };
}

export function findProposal(clientId: number, year: number): Proposal | null {
  const row = getDb()
    .prepare("SELECT * FROM proposals WHERE client_id = ? AND year = ?")
    .get(clientId, year) as ProposalRow | undefined;
  return row ? mapProposal(row) : null;
}

export function getProposal(id: number): Proposal | null {
  const row = getDb().prepare("SELECT * FROM proposals WHERE id = ?").get(id) as ProposalRow | undefined;
  return row ? mapProposal(row) : null;
}
