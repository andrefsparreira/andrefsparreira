import type Database from "better-sqlite3";
import { EXAMPLE_CLIENT, modeloLinhas, SERVICE_TYPES } from "./example";
import { buildProposalSections } from "./template";
import { DEFAULT_VAT_RATE } from "./pricing";
import { todayISO } from "./format";

function insertLines(db: Database.Database, yearId: number, exampleValues: boolean, employees: number) {
  const insert = db.prepare(`
    INSERT INTO fee_lines (
      year_id, sort_order, type_code, description, periodicity, quantity,
      inclusion, optional, unit_value, manual, pricing_rule, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  modeloLinhas({ exampleValues, employees }).forEach((line, index) => {
    insert.run(
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
    );
  });
}

export function seedIfEmpty(db: Database.Database) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM clients").get() as { n: number };
  if (count.n > 0) return;

  const tx = db.transaction(() => {
    db.prepare("INSERT INTO settings (key, value) VALUES ('vat_rate', ?)").run(String(DEFAULT_VAT_RATE));

    const insertType = db.prepare(`
      INSERT INTO service_types (
        code, label, default_periodicity, pricing_rule, default_inclusion,
        default_optional, default_unit_value, sort_order, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    for (const type of SERVICE_TYPES) {
      insertType.run(
        type.code,
        type.label,
        type.defaultPeriodicity,
        type.pricingRule,
        type.defaultInclusion,
        type.defaultOptional ? 1 : 0,
        type.defaultUnitValue,
        type.sortOrder,
      );
    }

    const client = EXAMPLE_CLIENT;
    const result = db.prepare(`
      INSERT INTO clients (
        name, nif, legal_form, object, irc_regime, iva_regime, capital, partners,
        bank_accounts, expected_turnover, employees_ex_manager, situation_date, notes, logo_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    );
    const clientId = Number(result.lastInsertRowid);

    const insertYear = db.prepare("INSERT INTO fee_years (client_id, year, note) VALUES (?, ?, ?)");
    const y2025 = Number(
      insertYear.run(
        clientId,
        2025,
        "Ano anterior sem valores no modelo Excel. O histórico fica disponível para lançamentos.",
      ).lastInsertRowid,
    );
    void y2025;
    const y2026 = Number(
      insertYear.run(
        clientId,
        2026,
        "Referência lida da folha Honorários, com a situação a 01/05/2026. O ficheiro não distingue um preço de 2026 face a 2027.",
      ).lastInsertRowid,
    );
    const y2027 = Number(
      insertYear.run(
        clientId,
        2027,
        "Ano alvo da proposta. Linhas inicializadas com os valores do modelo.",
      ).lastInsertRowid,
    );
    insertLines(db, y2026, true, client.employeesExManager);
    insertLines(db, y2027, true, client.employeesExManager);

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
    db.prepare(`
      INSERT INTO proposals (client_id, year, proposal_date, title, sections_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      clientId,
      2027,
      todayISO(),
      "Proposta de prestação de serviços 2027",
      JSON.stringify(sections),
    );
  });

  tx();
}
