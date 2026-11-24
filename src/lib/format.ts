export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function eur(n: number): string {
  const negative = n < 0;
  const [whole, frac] = Math.abs(round2(n)).toFixed(2).split(".");
  const grouped = (whole ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}${grouped},${frac ?? "00"} €`;
}

export function pct(rate: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(rate);
}

export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(/€/g, "");
  if (!s) return null;
  const n = s.includes(",")
    ? Number(s.replace(/\./g, "").replace(",", "."))
    : Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatDatePT(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatLongDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const PERIOD_LABEL: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
  one_shot: "One Shot",
};

export const INCLUSION_LABEL: Record<string, string> = {
  valor: "Valor",
  incluido: "Incluído",
  sob_consulta: "Sob consulta",
};

export const RULE_LABEL: Record<string, string> = {
  fixed: "Valor fixo",
  payroll: "Vencimentos (10 € / extra)",
  per_occurrence: "12 € / ocorrência",
  ru_tier: "Escalão do Relatório Único",
  included: "Incluído",
  consultation: "Sob consulta",
};
