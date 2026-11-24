import { eur, round2 } from "./format";
import type {
  BasePeriod,
  DocMedium,
  DocOrganization,
  Inclusion,
  Periodicity,
  PricingRule,
  RetainerChoice,
  RetainerKind,
  RetainerParameter,
  RetainerValue,
} from "./types";

/**
 * Parâmetros lidos de proposta-modelo.xlsx.
 * Folha Honorários e folha RU. Não há outras tabelas de preço no ficheiro.
 * A avença mensal de 150,00 € é o valor deste cliente (célula D11), não um mínimo geral.
 * «Desde 80,00 €» está na linha do Relatório Único (anual) e coincide com o escalão 1 a 5.
 */
export const PAYROLL_EXTRA_MONTHLY = 10;
export const ADMISSION_UNIT = 12;
export const ANNUAL_UPDATE_MONTHLY = 10;
export const RU_FROM = 80;
export const DEFAULT_VAT_RATE = 0.23;

export const RU_TIERS: {
  label: string;
  min: number;
  max: number | null;
  annual: number;
}[] = [
  { label: "1 a 5", min: 1, max: 5, annual: 80 },
  { label: "6 a 20", min: 6, max: 20, annual: 150 },
  { label: "21 a 50", min: 21, max: 50, annual: 200 },
  { label: "51 a 99", min: 51, max: 99, annual: 350 },
  { label: "A partir de 100", min: 100, max: null, annual: 550 },
];

export const TARIFF_NOTES: { servico: string; regra: string; origem: string }[] = [
  {
    servico: "Responsabilidade de CC e execução dos serviços",
    regra: "150,00 € por mês neste cliente (célula D11). Não é um preço de tabela para todos os clientes.",
    origem: "Honorários!D11",
  },
  {
    servico: "Avença de encerramento de contas anuais",
    regra: "150,00 € por ano",
    origem: "Honorários!F12",
  },
  {
    servico: "Reporting trimestral",
    regra: "Incluído",
    origem: "Honorários!E13",
  },
  {
    servico: "Processamento de vencimentos",
    regra: "Incluído o sócio-gerente + 10,00 € por funcionário extra, por mês",
    origem: "Honorários!D14",
  },
  {
    servico: "Admissões/cessações na Segurança Social",
    regra: "12,00 € por ocorrência",
    origem: "Honorários!G15",
  },
  {
    servico: "Relatório Único (opcional)",
    regra: "Desde 80,00 € por ano, por escalões de colaboradores excluindo o sócio-gerente",
    origem: "Honorários!F16 e folha RU",
  },
  {
    servico: "Emissão de faturas e ficheiro SAFT (opcional)",
    regra: "Sob consulta",
    origem: "Honorários!D17",
  },
  {
    servico: "Outros serviços solicitados",
    regra: "Sob consulta",
    origem: "Honorários!G18",
  },
  {
    servico: "Apoio no RCBE (opcional)",
    regra: "150,00 €",
    origem: "Honorários!G19",
  },
  {
    servico: "Livro de Atas (opcional)",
    regra: "100,00 €",
    origem: "Honorários!G20",
  },
  {
    servico: "Relatório de Gestão (opcional)",
    regra: "150,00 € por ano",
    origem: "Honorários!F21",
  },
  {
    servico: "Atualização anual",
    regra:
      "10,00 € + IVA por mês, ou a variação do IPC se o aumento resultante for superior a 10,00 €",
    origem: "Nota!B13",
  },
  {
    servico: "IVA, faturação e pagamento",
    regra:
      "Aos honorários acresce IVA à taxa legal. Faturas nos primeiros dias úteis. Pagamento a 30 dias.",
    origem: "Nota!B12 e Nota!B14",
  },
];

export type PricedLine = {
  description: string;
  periodicity: Periodicity;
  quantity: number | null;
  inclusion: Inclusion;
  optional: boolean;
  unitValue: number | null;
  manual: boolean;
  pricingRule: PricingRule;
  notes?: string;
  typeCode?: string;
};

export type ComputedLine = PricedLine & {
  periodAmount: number | null;
  annualAmount: number | null;
  sums: boolean;
  tierLabel: string | null;
  detail: string;
  cells: {
    mensal: string;
    trimestral: string;
    anual: string;
    oneShot: string;
    valorAnual: string;
  };
};

export type Summary = {
  lines: ComputedLine[];
  correnteByPeriod: Record<Periodicity, number>;
  opcionalByPeriod: Record<Periodicity, number>;
  subtotalCorrente: number;
  subtotalOpcional: number;
  vatRate: number;
  vatCorrente: number;
  totalCorrenteComIva: number;
  vatComOpcionais: number;
  totalComOpcionais: number;
  sobConsulta: number;
};

const EMPTY_PERIODS = (): Record<Periodicity, number> => ({
  mensal: 0,
  trimestral: 0,
  anual: 0,
  one_shot: 0,
});

export function ruTier(headcount: number) {
  if (!Number.isFinite(headcount) || headcount <= 0) return null;
  return (
    RU_TIERS.find(
      (tier) => headcount >= tier.min && (tier.max == null || headcount <= tier.max),
    ) ?? null
  );
}

export function annualize(amount: number, periodicity: Periodicity): number {
  if (periodicity === "mensal") return round2(amount * 12);
  if (periodicity === "trimestral") return round2(amount * 4);
  return round2(amount);
}

function blankCells(): ComputedLine["cells"] {
  return { mensal: "—", trimestral: "—", anual: "—", oneShot: "—", valorAnual: "—" };
}

function place(periodicity: Periodicity, label: string, annualLabel: string): ComputedLine["cells"] {
  const cells = blankCells();
  if (periodicity === "mensal") cells.mensal = label;
  if (periodicity === "trimestral") cells.trimestral = label;
  if (periodicity === "anual") cells.anual = label;
  if (periodicity === "one_shot") cells.oneShot = label;
  cells.valorAnual = annualLabel;
  return cells;
}

export function computeLine(line: PricedLine): ComputedLine {
  let periodAmount: number | null = null;
  let sums = false;
  let tierLabel: string | null = null;
  let detail = "";

  const pricedManually = line.manual && line.inclusion === "valor";

  if (pricedManually) {
    const mult =
      line.pricingRule === "fixed" && line.quantity != null && line.quantity > 0
        ? line.quantity
        : 1;
    periodAmount = round2((line.unitValue ?? 0) * mult);
    sums = true;
    detail = eur(periodAmount);
  } else if (line.inclusion === "sob_consulta" || line.pricingRule === "consultation") {
    detail = "Sob consulta";
  } else if (line.pricingRule === "payroll") {
    const extra = line.quantity ?? 0;
    periodAmount = round2(PAYROLL_EXTRA_MONTHLY * extra);
    sums = true;
    detail =
      extra > 0
        ? `Incluído (sócio-gerente) + ${eur(PAYROLL_EXTRA_MONTHLY)} × ${extra} = ${eur(periodAmount)}`
        : "Incluído (sócio-gerente)";
  } else if (line.pricingRule === "per_occurrence") {
    const qty = line.quantity ?? 0;
    periodAmount = round2(ADMISSION_UNIT * qty);
    sums = true;
    detail =
      qty > 0
        ? `${eur(ADMISSION_UNIT)} × ${qty} = ${eur(periodAmount)}`
        : `${eur(ADMISSION_UNIT)}/ocorrência`;
  } else if (line.pricingRule === "ru_tier") {
    const head = line.quantity ?? 0;
    const tier = ruTier(head);
    if (!tier) {
      tierLabel = "sem escalão";
      detail = `Desde ${eur(RU_FROM)}`;
    } else {
      tierLabel = tier.label;
      periodAmount = tier.annual;
      sums = true;
      detail = `${eur(tier.annual)} · escalão ${tier.label}`;
    }
  } else if (line.pricingRule === "included" || line.inclusion === "incluido") {
    periodAmount = 0;
    sums = true;
    detail = "Incluído";
  } else {
    const mult = line.quantity != null && line.quantity > 0 ? line.quantity : 1;
    periodAmount = round2((line.unitValue ?? 0) * mult);
    sums = true;
    detail = eur(periodAmount);
  }

  const annualAmount = periodAmount == null ? null : annualize(periodAmount, line.periodicity);
  const periodLabel =
    detail === "Incluído" || detail.startsWith("Incluído") || detail === "Sob consulta" || detail.startsWith("Desde")
      ? detail
      : detail;
  const annualLabel =
    annualAmount == null
      ? "—"
      : periodAmount === 0 && (detail === "Incluído" || detail === "Incluído (sócio-gerente)")
        ? "Incluído"
        : eur(annualAmount);

  return {
    ...line,
    periodAmount,
    annualAmount,
    sums,
    tierLabel,
    detail,
    cells: place(line.periodicity, periodLabel, annualLabel),
  };
}

export function computeSummary(lines: PricedLine[], vatRate = DEFAULT_VAT_RATE): Summary {
  const computed = lines.map(computeLine);
  const correnteByPeriod = EMPTY_PERIODS();
  const opcionalByPeriod = EMPTY_PERIODS();
  let subtotalCorrente = 0;
  let subtotalOpcional = 0;
  let sobConsulta = 0;

  for (const line of computed) {
    if (!line.sums || line.annualAmount == null) {
      if (line.detail === "Sob consulta") sobConsulta += 1;
      continue;
    }
    const bucket = line.optional ? opcionalByPeriod : correnteByPeriod;
    bucket[line.periodicity] = round2(bucket[line.periodicity] + line.annualAmount);
    if (line.optional) subtotalOpcional = round2(subtotalOpcional + line.annualAmount);
    else subtotalCorrente = round2(subtotalCorrente + line.annualAmount);
  }

  const vatCorrente = round2(subtotalCorrente * vatRate);
  const combined = round2(subtotalCorrente + subtotalOpcional);
  const vatComOpcionais = round2(combined * vatRate);

  return {
    lines: computed,
    correnteByPeriod,
    opcionalByPeriod,
    subtotalCorrente,
    subtotalOpcional,
    vatRate,
    vatCorrente,
    totalCorrenteComIva: round2(subtotalCorrente + vatCorrente),
    vatComOpcionais,
    totalComOpcionais: round2(combined + vatComOpcionais),
    sobConsulta,
  };
}

export function suggestMonthlyUpdate(monthlyAmount: number, ipcRate: number | null) {
  const ipcIncrease = ipcRate == null ? 0 : round2(monthlyAmount * ipcRate);
  const useIpc = ipcIncrease > ANNUAL_UPDATE_MONTHLY;
  return {
    ipcIncrease,
    applied: useIpc ? ipcIncrease : ANNUAL_UPDATE_MONTHLY,
    basis: useIpc ? ("ipc" as const) : ("base" as const),
  };
}

export function monthlyRunRate(summary: Summary): number {
  return round2(
    summary.lines.reduce((sum, line) => {
      if (line.periodicity !== "mensal" || line.inclusion !== "valor" || line.periodAmount == null) {
        return sum;
      }
      if (line.optional) return sum;
      return sum + line.periodAmount;
    }, 0),
  );
}

/** Avença mensal de partida. Os parâmetros somam-se a este valor. */
export const BASE_MONTHLY_RETAINER = 150;
export const HISTORY_YEARS = 5;

export const DOC_ORGANIZATION: { id: DocOrganization; label: string; hint: string; monthly: number }[] = [
  { id: "organizada", label: "Organizada", hint: "Documentos identificados e por ordem.", monthly: 0 },
  { id: "alguma", label: "Alguma dificuldade", hint: "Atrasos pontuais ou classificação incompleta.", monthly: 25 },
  { id: "desorganizada", label: "Desorganizada", hint: "Exige triagem regular antes do lançamento.", monthly: 50 },
  { id: "muito_desorganizada", label: "Muito desorganizada", hint: "Reconstrução frequente do suporte.", monthly: 90 },
];

/** Quantidade média de documentos por mês. */
export const DOC_VOLUME: { max: number | null; label: string; monthly: number }[] = [
  { max: 40, label: "Até 40 documentos por mês", monthly: 0 },
  { max: 120, label: "41 a 120 documentos por mês", monthly: 20 },
  { max: 300, label: "121 a 300 documentos por mês", monthly: 45 },
  { max: null, label: "Mais de 300 documentos por mês", monthly: 80 },
];

export const DOC_MEDIUM: { id: DocMedium; label: string; hint: string; monthly: number }[] = [
  {
    id: "digital",
    label: "Digital",
    hint: "Mais acessível: já está contemplado na base de 150,00 €.",
    monthly: 0,
  },
  { id: "misto", label: "Misto", hint: "Parte em papel e parte digital.", monthly: 15 },
  { id: "fisico", label: "Físico", hint: "Papel: recolha, arquivo e digitalização.", monthly: 40 },
];

export const TURNOVER_BANDS: { max: number | null; label: string; monthly: number }[] = [
  { max: 50_000, label: "Até 50.000 €", monthly: 0 },
  { max: 150_000, label: "De 50.001 € a 150.000 €", monthly: 25 },
  { max: 400_000, label: "De 150.001 € a 400.000 €", monthly: 60 },
  { max: 1_000_000, label: "De 400.001 € a 1.000.000 €", monthly: 110 },
  { max: null, label: "Acima de 1.000.000 €", monthly: 180 },
];

export type RetainerPart = { label: string; detail: string; amount: number };

export type RetainerQuote = {
  base: number;
  period: BasePeriod;
  parts: RetainerPart[];
  periodAmount: number;
  annual: number;
};

export function historyWindow(proposalYear: number): number[] {
  return Array.from({ length: HISTORY_YEARS }, (_, index) => proposalYear - HISTORY_YEARS + index);
}

export function periodsPerYear(period: BasePeriod): number {
  return period === "trimestral" ? 4 : 12;
}

export function periodLabel(period: BasePeriod): string {
  return period === "trimestral" ? "trimestre" : "mês";
}

function valueOf(
  kind: RetainerKind,
  label: string,
  amount: number,
  sortOrder: number,
  rangeMin: number | null = null,
  rangeMax: number | null = null,
  id = sortOrder,
): RetainerValue {
  return { id, parameterId: 0, label, amount, rangeMin, rangeMax, sortOrder };
}

export function defaultRetainerCatalog(): RetainerParameter[] {
  const organization: RetainerParameter = {
    id: 1,
    name: "Organização da documentação",
    kind: "opcao",
    sortOrder: 10,
    values: DOC_ORGANIZATION.map((item, index) => valueOf("opcao", item.label, item.monthly, (index + 1) * 10)),
  };
  const volume: RetainerParameter = {
    id: 2,
    name: "Quantidade de documentos",
    kind: "escalao",
    sortOrder: 20,
    values: [
      valueOf("escalao", DOC_VOLUME[0]!.label, DOC_VOLUME[0]!.monthly, 10, 0, 40),
      valueOf("escalao", DOC_VOLUME[1]!.label, DOC_VOLUME[1]!.monthly, 20, 41, 120),
      valueOf("escalao", DOC_VOLUME[2]!.label, DOC_VOLUME[2]!.monthly, 30, 121, 300),
      valueOf("escalao", DOC_VOLUME[3]!.label, DOC_VOLUME[3]!.monthly, 40, 301, null),
    ],
  };
  const medium: RetainerParameter = {
    id: 3,
    name: "Suporte da documentação",
    kind: "opcao",
    sortOrder: 30,
    values: DOC_MEDIUM.map((item, index) => valueOf("opcao", item.label, item.monthly, (index + 1) * 10)),
  };
  const turnover: RetainerParameter = {
    id: 4,
    name: "Faturação anual",
    kind: "escalao",
    sortOrder: 40,
    values: [
      valueOf("escalao", TURNOVER_BANDS[0]!.label, TURNOVER_BANDS[0]!.monthly, 10, 0, 50_000),
      valueOf("escalao", TURNOVER_BANDS[1]!.label, TURNOVER_BANDS[1]!.monthly, 20, 50_001, 150_000),
      valueOf("escalao", TURNOVER_BANDS[2]!.label, TURNOVER_BANDS[2]!.monthly, 30, 150_001, 400_000),
      valueOf("escalao", TURNOVER_BANDS[3]!.label, TURNOVER_BANDS[3]!.monthly, 40, 400_001, 1_000_000),
      valueOf("escalao", TURNOVER_BANDS[4]!.label, TURNOVER_BANDS[4]!.monthly, 50, 1_000_001, null),
    ],
  };
  for (const parameter of [organization, volume, medium, turnover]) {
    for (const value of parameter.values) value.parameterId = parameter.id;
  }
  return [organization, volume, medium, turnover];
}

function matchingBand(values: RetainerValue[], numeric: number | null): RetainerValue | null {
  if (numeric == null || !Number.isFinite(numeric) || numeric < 0) return null;
  const ordered = [...values].sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    ordered.find(
      (value) =>
        (value.rangeMin == null || numeric >= value.rangeMin) &&
        (value.rangeMax == null || numeric <= value.rangeMax),
    ) ?? null
  );
}

export function computeBaseRetainer(input: {
  baseAmount: number;
  period: BasePeriod;
  parameters: RetainerParameter[];
  selections: RetainerChoice[];
  manualAdjust: number;
}): RetainerQuote {
  const period: BasePeriod = input.period === "trimestral" ? "trimestral" : "mensal";
  const base = Number.isFinite(input.baseAmount) ? round2(Math.max(0, input.baseAmount)) : 0;
  const parts: RetainerPart[] = [];
  for (const parameter of [...input.parameters].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const selection = input.selections.find((item) => item.parameterId === parameter.id);
    if (parameter.kind === "opcao") {
      const chosen = parameter.values.find((value) => value.id === selection?.valueId) ?? null;
      parts.push({
        label: parameter.name,
        detail: chosen?.label ?? "Por escolher",
        amount: chosen?.amount ?? 0,
      });
      continue;
    }
    const band = matchingBand(parameter.values, selection?.numeric ?? null);
    const shown =
      selection?.numeric == null
        ? "Valor por indicar"
        : band
          ? `${band.label} (${selection.numeric})`
          : `${selection.numeric} · sem escalão`;
    parts.push({ label: parameter.name, detail: shown, amount: band?.amount ?? 0 });
  }
  const manual = Number.isFinite(input.manualAdjust) ? round2(input.manualAdjust) : 0;
  parts.push({ label: "Ajuste manual", detail: manual === 0 ? "Nenhum" : eur(manual), amount: manual });
  const periodAmount = round2(Math.max(0, base + parts.reduce((sum, part) => sum + part.amount, 0)));
  return {
    base,
    period,
    parts,
    periodAmount,
    annual: round2(periodAmount * periodsPerYear(period)),
  };
}
