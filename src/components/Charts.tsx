import { eur } from "@/lib/format";
import { RU_TIERS, ruTier, type Summary } from "@/lib/pricing";

const PERIODS = [
  { key: "mensal", label: "Mensal × 12" },
  { key: "trimestral", label: "Trimestral × 4" },
  { key: "anual", label: "Anual" },
  { key: "one_shot", label: "One Shot" },
] as const;

export function CompositionChart({ summary }: { summary: Summary }) {
  const rows = PERIODS.map((period) => ({
    label: period.label,
    corrente: summary.correnteByPeriod[period.key],
    opcional: summary.opcionalByPeriod[period.key],
  }));
  const max = Math.max(1, ...rows.map((row) => row.corrente + row.opcional));

  return (
    <figure className="rounded-xl border border-line bg-white p-4">
      <figcaption className="mb-3 font-serif text-lg text-navy">Composição anual dos honorários</figcaption>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm">
            <div className="text-muted">{row.label}</div>
            <div className="flex h-3 overflow-hidden rounded-full bg-paper">
              <div className="h-full bg-navy" style={{ width: `${(row.corrente / max) * 100}%` }} />
              <div className="h-full bg-[#9aa8c2]" style={{ width: `${(row.opcional / max) * 100}%` }} />
            </div>
            <div className="w-28 text-right tabular-nums">{eur(row.corrente + row.opcional)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted">
        <span><i className="mr-1 inline-block h-2 w-2 bg-navy" /> Correntes</span>
        <span><i className="mr-1 inline-block h-2 w-2 bg-[#9aa8c2]" /> Opcionais</span>
      </div>
    </figure>
  );
}

export function RuChart({ headcount }: { headcount: number | null }) {
  const active = headcount == null ? null : ruTier(headcount);
  const max = RU_TIERS[RU_TIERS.length - 1]?.annual ?? 1;
  return (
    <figure className="rounded-xl border border-line bg-white p-4">
      <figcaption className="mb-3 font-serif text-lg text-navy">Escalões do Relatório Único</figcaption>
      <div className="space-y-2">
        {RU_TIERS.map((tier) => {
          const on = active?.label === tier.label;
          return (
            <div key={tier.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-sm">
              <div className={on ? "font-medium text-navy" : "text-muted"}>{tier.label}</div>
              <div className="h-3 rounded-full bg-paper">
                <div
                  className={`h-full rounded-full ${on ? "bg-[#8d2f39]" : "bg-navy/70"}`}
                  style={{ width: `${(tier.annual / max) * 100}%` }}
                />
              </div>
              <div className="w-24 text-right tabular-nums">{eur(tier.annual)}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">
        Colaboradores excluindo o sócio-gerente
        {headcount == null ? "." : `: ${headcount}.`}
        {headcount === 0 ? " Sem escalão aplicável; o modelo indica desde 80,00 €." : ""}
      </p>
    </figure>
  );
}
