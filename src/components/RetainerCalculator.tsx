"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRetainerAssessment } from "@/app/actions";
import { eur, parseDecimal } from "@/lib/format";
import {
  BASE_MONTHLY_RETAINER,
  computeRetainer,
  DOC_MEDIUM,
  DOC_ORGANIZATION,
  DOC_VOLUME,
  TURNOVER_BANDS,
} from "@/lib/pricing";
import type { ClientStatus, DocMedium, DocOrganization, FeeYear } from "@/lib/types";

const input = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";

export function RetainerCalculator({ year, fallbackTurnover }: { year: FeeYear; fallbackTurnover: number | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<ClientStatus>(year.clientStatus);
  const [organization, setOrganization] = useState<DocOrganization>(year.docOrganization);
  const [docCount, setDocCount] = useState(year.docCount == null ? "" : String(year.docCount));
  const [medium, setMedium] = useState<DocMedium>(year.docMedium);
  const [turnover, setTurnover] = useState(
    year.turnover == null ? (fallbackTurnover == null ? "" : String(fallbackTurnover)) : String(year.turnover),
  );
  const [manual, setManual] = useState(year.manualAdjust ? String(year.manualAdjust).replace(".", ",") : "");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const quote = useMemo(
    () =>
      computeRetainer({
        proposalYear: year.year,
        clientStatus: status,
        docOrganization: organization,
        docCount: parseDecimal(docCount),
        docMedium: medium,
        turnover: parseDecimal(turnover),
        manualAdjust: parseDecimal(manual) ?? 0,
      }),
    [year.year, status, organization, docCount, medium, turnover, manual],
  );

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await saveRetainerAssessment({
        yearId: year.id,
        clientStatus: status,
        docOrganization: organization,
        docCount: parseDecimal(docCount),
        docMedium: medium,
        turnover: parseDecimal(turnover),
        manualAdjust: parseDecimal(manual) ?? 0,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(`Avença de ${year.year} guardada: ${eur(result.monthly)} por mês.`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h3 className="font-serif text-2xl text-navy">Cálculo da avença de {year.year}</h3>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        A base é {eur(BASE_MONTHLY_RETAINER)} por mês. Esse valor já cobre documentação digital, organizada, até 40
        documentos por mês e faturação anual até 50.000 €. A documentação digital é a situação mais acessível; papel,
        volume, desorganização e faturação mais alta aumentam a avença. O ajuste manual pode reduzir ou aumentar o resultado.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Situação do cliente
          <select className={input} value={status} onChange={(event) => setStatus(event.target.value as ClientStatus)}>
            <option value="atual">Cliente atual — faturação do ano anterior</option>
            <option value="novo">Cliente novo — faturação esperada no final do ano</option>
          </select>
        </label>
        <label className="text-sm">
          Organização da documentação
          <select
            className={input}
            value={organization}
            onChange={(event) => setOrganization(event.target.value as DocOrganization)}
          >
            {DOC_ORGANIZATION.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.monthly === 0 ? "incluído na base" : `+${eur(item.monthly)}`})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Quantidade média de documentos por mês
          <input
            className={input}
            inputMode="numeric"
            value={docCount}
            placeholder="ex.: 30"
            onChange={(event) => setDocCount(event.target.value)}
          />
        </label>
        <label className="text-sm">
          Suporte da documentação
          <select className={input} value={medium} onChange={(event) => setMedium(event.target.value as DocMedium)}>
            {DOC_MEDIUM.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.monthly === 0 ? "incluído na base" : `+${eur(item.monthly)}`})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          {quote.turnoverCaption}
          <input
            className={input}
            inputMode="decimal"
            value={turnover}
            placeholder="ex.: 40000"
            onChange={(event) => setTurnover(event.target.value)}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Ajuste manual (€ por mês, negativo para desconto)
          <input
            className={input}
            inputMode="decimal"
            value={manual}
            placeholder="0"
            onChange={(event) => setManual(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-line">
              <td className="px-3 py-2">Base mensal</td>
              <td className="px-3 py-2 text-right tabular-nums">{eur(quote.base)}</td>
            </tr>
            {quote.parts.map((part) => (
              <tr key={part.label} className="border-b border-line">
                <td className="px-3 py-2">
                  {part.label}
                  <span className="mt-0.5 block text-xs text-muted">{part.detail}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {part.monthly > 0 ? "+" : ""}
                  {eur(part.monthly)}
                </td>
              </tr>
            ))}
            <tr className="bg-paper">
              <td className="px-3 py-3 font-medium text-navy">Avença mensal</td>
              <td className="px-3 py-3 text-right font-serif text-xl text-navy tabular-nums">{eur(quote.monthly)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-muted">Equivalente anual (× 12)</td>
              <td className="px-3 py-2 text-right tabular-nums">{eur(quote.annual)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <details className="mt-3 text-sm text-muted">
        <summary className="cursor-pointer text-navy">Ver escalões de documentos e de faturação</summary>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <ul className="space-y-1">
            {DOC_VOLUME.map((band) => (
              <li key={band.label}>
                {band.label}: {band.monthly === 0 ? "incluído" : `+${eur(band.monthly)}`}
              </li>
            ))}
          </ul>
          <ul className="space-y-1">
            {TURNOVER_BANDS.map((band) => (
              <li key={band.label}>
                {band.label}: {band.monthly === 0 ? "incluído" : `+${eur(band.monthly)}`}
              </li>
            ))}
          </ul>
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md bg-navy px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {pending ? "A guardar…" : "Guardar e aplicar à avença mensal"}
        </button>
        {message ? <p className="text-sm text-navy">{message}</p> : null}
      </div>
    </section>
  );
}
