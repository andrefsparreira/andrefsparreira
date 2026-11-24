import { eur, pct } from "@/lib/format";
import type { Summary } from "@/lib/pricing";

export function HonorariosTable({ summary }: { summary: Summary }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-navy text-left text-white">
              <th className="px-3 py-2 font-medium">Serviço</th>
              <th className="px-3 py-2 text-center font-medium">Mensal</th>
              <th className="px-3 py-2 text-center font-medium">Trimestral</th>
              <th className="px-3 py-2 text-center font-medium">Anual</th>
              <th className="px-3 py-2 text-center font-medium">One Shot</th>
              <th className="px-3 py-2 text-right font-medium">Valor anual</th>
            </tr>
          </thead>
          <tbody>
            {summary.lines.map((line, index) => (
              <tr key={`${line.description}-${index}`} className={index % 2 ? "bg-paper/70" : "bg-white"}>
                <td className="border-b border-line px-3 py-2 align-top">
                  <div className="font-medium text-ink">{line.description}</div>
                  {line.optional ? (
                    <div className="text-xs uppercase tracking-wide text-muted">Opcional</div>
                  ) : null}
                </td>
                <td className="border-b border-line px-3 py-2 text-center align-top text-ink">{line.cells.mensal}</td>
                <td className="border-b border-line px-3 py-2 text-center align-top">{line.cells.trimestral}</td>
                <td className="border-b border-line px-3 py-2 text-center align-top">{line.cells.anual}</td>
                <td className="border-b border-line px-3 py-2 text-center align-top">{line.cells.oneShot}</td>
                <td className="border-b border-line px-3 py-2 text-right align-top font-medium">{line.cells.valorAnual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Correntes, valor anual" value={eur(summary.subtotalCorrente)} />
        <Stat label="Opcionais com valor" value={eur(summary.subtotalOpcional)} />
        <Stat
          label={`IVA ${pct(summary.vatRate)} sobre correntes`}
          value={eur(summary.vatCorrente)}
        />
        <Stat label="Total correntes com IVA" value={eur(summary.totalCorrenteComIva)} emphasis />
      </dl>
      <p className="text-sm text-muted">
        Se os opcionais com preço forem adjudicados, o total anual passa a {eur(summary.subtotalCorrente + summary.subtotalOpcional)} e, com IVA, a {eur(summary.totalComOpcionais)}.
        {summary.sobConsulta > 0
          ? ` ${summary.sobConsulta} linha(s) sob consulta ficam de fora da soma.`
          : ""}
      </p>
    </div>
  );
}

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${emphasis ? "border-navy bg-navy-soft" : "border-line bg-white"}`}>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-lg text-navy">{value}</dd>
    </div>
  );
}
