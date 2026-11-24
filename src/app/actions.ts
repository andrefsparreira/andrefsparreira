"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { modeloLinhas } from "@/lib/example";
import { parseDecimal, todayISO } from "@/lib/format";
import { buildProposalSections } from "@/lib/template";
import { getClient, getLines, getYear } from "@/lib/queries";
import type { Inclusion, LineDraft, Periodicity, PricingRule, ProposalSection } from "@/lib/types";

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

export async function createClient(formData: FormData) {
  const name = text(formData, "name");
  if (!name) redirect("/clientes/novo?erro=nome");
  const nif = text(formData, "nif");
  if (nif && !/^\d{9}$/.test(nif)) redirect("/clientes/novo?erro=nif");

  const db = getDb();
  const result = db
    .prepare(
      `INSERT INTO clients (
        name, nif, legal_form, object, irc_regime, iva_regime, capital, partners,
        bank_accounts, expected_turnover, employees_ex_manager, situation_date, notes, logo_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    )
    .run(
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
    );
  const id = Number(result.lastInsertRowid);
  db.prepare("INSERT INTO fee_years (client_id, year, note) VALUES (?, 2027, ?)").run(
    id,
    "Ano alvo da proposta.",
  );
  revalidatePath("/");
  redirect(`/clientes/${id}?ok=criado`);
}

export async function updateClient(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = text(formData, "name");
  if (!name) redirect(`/clientes/${id}?erro=nome`);
  const nif = text(formData, "nif");
  if (nif && !/^\d{9}$/.test(nif)) redirect(`/clientes/${id}?erro=nif`);
  getDb()
    .prepare(
      `UPDATE clients SET
        name = ?, nif = ?, legal_form = ?, object = ?, irc_regime = ?, iva_regime = ?,
        capital = ?, partners = ?, bank_accounts = ?, expected_turnover = ?,
        employees_ex_manager = ?, situation_date = ?, notes = ?
       WHERE id = ?`,
    )
    .run(
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
    );
  revalidatePath("/");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}?ok=ficha`);
}

export async function deleteClient(formData: FormData) {
  const id = Number(formData.get("id"));
  getDb().prepare("DELETE FROM clients WHERE id = ?").run(id);
  revalidatePath("/");
  redirect("/");
}

export async function createYear(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const year = Number(formData.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    redirect(`/clientes/${clientId}?erro=ano`);
  }
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM fee_years WHERE client_id = ? AND year = ?")
    .get(clientId, year) as { id: number } | undefined;
  if (existing) redirect(`/clientes/${clientId}?ano=${year}`);

  const note = text(formData, "note");
  const created = db
    .prepare("INSERT INTO fee_years (client_id, year, note) VALUES (?, ?, ?)")
    .run(clientId, year, note);
  const yearId = Number(created.lastInsertRowid);
  const copyFrom = Number(formData.get("copyFrom"));
  if (copyFrom) {
    const lines = getLines(copyFrom);
    const insert = db.prepare(
      `INSERT INTO fee_lines (
        year_id, sort_order, type_code, description, periodicity, quantity,
        inclusion, optional, unit_value, manual, pricing_rule, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    lines.forEach((line, index) => {
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
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?ano=${year}`);
}

export async function saveYearLines(input: {
  yearId: number;
  vatRate: number;
  lines: LineDraft[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const yearRow = getDb()
    .prepare("SELECT id, client_id FROM fee_years WHERE id = ?")
    .get(input.yearId) as { id: number; client_id: number } | undefined;
  if (!yearRow) return { ok: false, error: "Ano não encontrado." };
  if (!Number.isFinite(input.vatRate) || input.vatRate < 0 || input.vatRate > 1) {
    return { ok: false, error: "A taxa de IVA tem de estar entre 0% e 100%." };
  }

  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO settings (key, value) VALUES ('vat_rate', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).run(String(input.vatRate));
    db.prepare("DELETE FROM fee_lines WHERE year_id = ?").run(input.yearId);
    const insert = db.prepare(
      `INSERT INTO fee_lines (
        year_id, sort_order, type_code, description, periodicity, quantity,
        inclusion, optional, unit_value, manual, pricing_rule, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    input.lines.forEach((line, index) => {
      if (!line.description.trim()) return;
      const periodicity = PERIODS.has(line.periodicity) ? line.periodicity : "mensal";
      const inclusion = INCLUSIONS.has(line.inclusion) ? line.inclusion : "valor";
      const rule = RULES.has(line.pricingRule) ? line.pricingRule : "fixed";
      insert.run(
        input.yearId,
        index + 1,
        line.typeCode || "outros",
        line.description.trim(),
        periodicity,
        line.quantity,
        inclusion,
        line.optional ? 1 : 0,
        line.unitValue,
        line.manual ? 1 : 0,
        rule,
        line.notes?.trim() ?? "",
      );
    });
  });
  tx();
  revalidatePath(`/clientes/${yearRow.client_id}`);
  revalidatePath("/");
  return { ok: true };
}

export async function loadModelLines(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const year = Number(formData.get("year"));
  const client = getClient(clientId);
  const feeYear = client ? getYear(clientId, year) : null;
  if (!client || !feeYear) redirect(`/clientes/${clientId}`);
  const lines = modeloLinhas({ exampleValues: false, employees: client.employeesExManager });
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM fee_lines WHERE year_id = ?").run(feeYear.id);
    const insert = db.prepare(
      `INSERT INTO fee_lines (
        year_id, sort_order, type_code, description, periodicity, quantity,
        inclusion, optional, unit_value, manual, pricing_rule, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    lines.forEach((line, index) => {
      insert.run(
        feeYear.id,
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
  });
  tx();
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/clientes/${clientId}?ano=${year}&ok=modelo`);
}

export async function saveServiceType(formData: FormData) {
  const label = text(formData, "label");
  if (!label) redirect("/tabela?erro=tipo");
  const codeInput = text(formData, "code");
  const code = codeInput || slug(label);
  const periodicity = text(formData, "periodicity");
  const rule = text(formData, "pricingRule");
  const inclusion = text(formData, "inclusion");
  const db = getDb();
  const sort = (db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS n FROM service_types").get() as { n: number }).n + 10;
  db.prepare(
    `INSERT INTO service_types (
      code, label, default_periodicity, pricing_rule, default_inclusion,
      default_optional, default_unit_value, sort_order, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(code) DO UPDATE SET
      label = excluded.label,
      default_periodicity = excluded.default_periodicity,
      pricing_rule = excluded.pricing_rule,
      default_inclusion = excluded.default_inclusion,
      default_optional = excluded.default_optional,
      default_unit_value = excluded.default_unit_value,
      active = 1`,
  ).run(
    code,
    label,
    PERIODS.has(periodicity as Periodicity) ? periodicity : "mensal",
    RULES.has(rule as PricingRule) ? rule : "fixed",
    INCLUSIONS.has(inclusion as Inclusion) ? inclusion : "valor",
    formData.get("optional") ? 1 : 0,
    optionalNumber(formData, "unitValue"),
    codeInput ? (db.prepare("SELECT sort_order FROM service_types WHERE code = ?").get(code) as { sort_order: number } | undefined)?.sort_order ?? sort : sort,
  );
  revalidatePath("/tabela");
  redirect("/tabela?ok=tipo");
}

export async function deactivateServiceType(formData: FormData) {
  const code = text(formData, "code");
  getDb().prepare("UPDATE service_types SET active = 0 WHERE code = ?").run(code);
  revalidatePath("/tabela");
  redirect("/tabela");
}

export async function openProposal(formData: FormData) {
  const clientId = Number(formData.get("clientId"));
  const year = Number(formData.get("year"));
  const client = getClient(clientId);
  if (!client) redirect("/");
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM proposals WHERE client_id = ? AND year = ?")
    .get(clientId, year) as { id: number } | undefined;
  if (existing) redirect(`/propostas/${existing.id}`);
  const sections = buildProposalSections(client, year);
  const result = db
    .prepare(
      `INSERT INTO proposals (client_id, year, proposal_date, title, sections_json)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      clientId,
      year,
      todayISO(),
      `Proposta de prestação de serviços ${year}`,
      JSON.stringify(sections),
    );
  revalidatePath(`/clientes/${clientId}`);
  redirect(`/propostas/${Number(result.lastInsertRowid)}`);
}

export async function saveProposal(input: {
  id: number;
  proposalDate: string;
  sections: ProposalSection[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.proposalDate)) {
    return { ok: false, error: "Indique a data da proposta." };
  }
  getDb()
    .prepare(
      `UPDATE proposals
       SET proposal_date = ?, sections_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .run(input.proposalDate, JSON.stringify(input.sections), input.id);
  revalidatePath(`/propostas/${input.id}`);
  return { ok: true };
}

export async function resetProposalTexts(formData: FormData) {
  const id = Number(formData.get("id"));
  const row = getDb()
    .prepare("SELECT client_id, year FROM proposals WHERE id = ?")
    .get(id) as { client_id: number; year: number } | undefined;
  if (!row) redirect("/");
  const client = getClient(row.client_id);
  if (!client) redirect("/");
  const sections = buildProposalSections(client, row.year);
  getDb()
    .prepare("UPDATE proposals SET sections_json = ?, updated_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(sections), id);
  revalidatePath(`/propostas/${id}`);
  redirect(`/propostas/${id}?editar=1&ok=textos`);
}
