import type { Query } from "./db";
import { EXAMPLE_CLIENT, modeloLinhas, SERVICE_TYPES } from "./example";
import { todayISO } from "./format";
import { DEFAULT_VAT_RATE } from "./pricing";
import { buildProposalSections } from "./template";
import type { LineDraft } from "./types";

const insertLine = `
  INSERT INTO fee_lines (
    year_id, sort_order, type_code, description, periodicity, quantity,
    inclusion, optional, unit_value, manual, pricing_rule, notes
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
`;

export async function insertDrafts(query: Query, yearId: number, lines: LineDraft[]) {
  for (const [index, line] of lines.entries()) {
    await query(insertLine, [
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

export async function seedIfEmpty(query: Query) {
  const count = await query<{ n: number }>("SELECT COUNT(*)::int AS n FROM clients");
  if (Number(count[0]?.n ?? 0) > 0) return;

  await query("INSERT INTO settings (key, value) VALUES ('vat_rate', $1)", [String(DEFAULT_VAT_RATE)]);
  for (const type of SERVICE_TYPES) {
    await query(
      `INSERT INTO service_types (
        code, label, default_periodicity, pricing_rule, default_inclusion,
        default_optional, default_unit_value, sort_order, active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
      [
        type.code,
        type.label,
        type.defaultPeriodicity,
        type.pricingRule,
        type.defaultInclusion,
        type.defaultOptional ? 1 : 0,
        type.defaultUnitValue,
        type.sortOrder,
      ],
    );
  }

  const client = EXAMPLE_CLIENT;
  const inserted = await query<{ id: number }>(
    `INSERT INTO clients (
      name, nif, legal_form, object, irc_regime, iva_regime, capital, partners,
      bank_accounts, expected_turnover, employees_ex_manager, situation_date, notes, logo_path
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id`,
    [
      client.name,
      client.nif,
      client.legalForm,
      client.object,
      client.ircRegime,
      client.ivaRegime,
      client.capital,
      client.partners,
      client.bankAccounts,
      client.expectedTurnover,
      client.employeesExManager,
      client.situationDate,
      client.notes,
      client.logoPath,
    ],
  );
  const clientId = Number(inserted[0]?.id);

  const year = async (value: number, note: string) => {
    const row = await query<{ id: number }>(
      "INSERT INTO fee_years (client_id, year, note) VALUES ($1, $2, $3) RETURNING id",
      [clientId, value, note],
    );
    return Number(row[0]?.id);
  };

  await year(2025, "Ano anterior sem valores no modelo Excel. O histórico fica disponível para lançamentos.");
  const y2026 = await year(
    2026,
    "Referência lida da folha Honorários, com a situação a 01/05/2026. O ficheiro não distingue um preço de 2026 face a 2027.",
  );
  const y2027 = await year(2027, "Ano alvo da proposta. Linhas inicializadas com os valores do modelo.");
  const lines = modeloLinhas({ exampleValues: true, employees: client.employeesExManager });
  await insertDrafts(query, y2026, lines);
  await insertDrafts(query, y2027, lines);

  const sections = buildProposalSections(
    {
      id: clientId,
      name: client.name,
      nif: client.nif,
      legalForm: client.legalForm,
      object: client.object,
      ircRegime: client.ircRegime,
      ivaRegime: client.ivaRegime,
      capital: client.capital,
      partners: client.partners,
      bankAccounts: client.bankAccounts,
      expectedTurnover: client.expectedTurnover,
      employeesExManager: client.employeesExManager,
      situationDate: client.situationDate,
      notes: client.notes,
      logoPath: client.logoPath,
    },
    2027,
  );
  await query(
    `INSERT INTO proposals (client_id, year, proposal_date, title, sections_json)
     VALUES ($1, $2, $3, $4, $5)`,
    [clientId, 2027, todayISO(), "Proposta de prestação de serviços 2027", JSON.stringify(sections)],
  );
}
