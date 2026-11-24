"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRetainerAssessment } from "@/app/actions";
import { eur, parseDecimal } from "@/lib/format";
import { computeBaseRetainer, periodLabel } from "@/lib/pricing";
import type { BasePeriod, ClientStatus, FeeYear, RetainerChoice, RetainerParameter } from "@/lib/types";

const input = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";

function initialChoice(
  parameter: RetainerParameter,
  saved: RetainerChoice | undefined,
  year: FeeYear,
  fallbackTurnover: number | null,
): { valueId: number | null; numeric: string } {
  if (saved) {
    return { valueId: saved.valueId, numeric: saved.numeric == null ? "" : String(saved.numeric).replace(".", ",") };
  }
  if (parameter.kind === "opcao") {
    const neutral = parameter.values.find((value) => value.amount === 0) ?? parameter.values[0];
    return { valueId: neutral?.id ?? null, numeric: "" };
  }
  let numeric: number | null = null;
  if (/document/i.test(parameter.name)) numeric = year.docCount;
  if (/fatura/i.test(parameter.name)) numeric = year.turnover ?? fallbackTurnover;
  return { valueId: null, numeric: numeric == null ? "" : String(numeric).replace(".", ",") };
}

export function RetainerCalculator({
  year,
  fallbackTurnover,
  baseAmount,
  parameters,
  choices,
}: {
  year: FeeYear;
  fallbackTurnover: number | null;
  baseAmount: number;
  parameters: RetainerParameter[];
  choices: RetainerChoice[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ClientStatus>(year.clientStatus);
  const [period, setPeriod] = useState<BasePeriod>(year.basePeriod);
  const [manual, setManual] = useState(year.manualAdjust ? String(year.manualAdjust).replace(".", ",") : "");
  const [selected, setSelected] = useState<Record<number, { valueId: number | null; numeric: string }>>(() =>
    Object.fromEntries(
      parameters.map((parameter) => [
        parameter.id,
        initialChoice(
          parameter,
          choices.find((choice) => choice.parameterId === parameter.id),
          year,
          fallbackTurnover,
        ),
      ]),
    ),
  );
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const selections: RetainerChoice[] = parameters.map((parameter) => ({
    parameterId: parameter.id,
    valueId: selected[parameter.id]?.valueId ?? null,
    numeric: parameter.kind === "escalao" ? parseDecimal(selected[parameter.id]?.numeric ?? "") : null,
  }));
  const quote = useMemo(
    () =>
      computeBaseRetainer({
        baseAmount,
        period,
        parameters,
        selections,
        manualAdjust: parseDecimal(manual) ?? 0,
      }),
    [baseAmount, period, parameters, selected, manual],
  );

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await saveRetainerAssessment({
        yearId: year.id,
        clientStatus: status,
        period,
        manualAdjust: parseDecimal(manual) ?? 0,
        selections,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(`Avença base de ${year.year} guardada: ${eur(result.amount)} por ${periodLabel(result.period)}.`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h3 className="font-serif text-2xl text-navy">Cálculo da avença base de {year.year}</h3>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Parte de {eur(baseAmount)} por {periodLabel(period)}. Os parâmetros acima ajustam só esta avença base. A
        periodicidade pode ser mensal ou trimestral. O ajuste manual pode reduzir ou aumentar o resultado.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm">
          Periodicidade da avença base
          <select className={input} value={period} onChange={(event) => setPeriod(event.target.value as BasePeriod)}>
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
          </select>
        </label>
        <label className="text-sm">
          Situação do cliente
          <select className={input} value={status} onChange={(event) => setStatus(event.target.value as ClientStatus)}>
            <option value="atual">Cliente atual — a faturação é a do ano anterior</option>
            <option value="novo">Cliente novo — a faturação é a esperada no final do ano</option>
          </select>
        </label>
        {parameters.map((parameter) => {
          const current = selected[parameter.id];
          const caption =
            /fatura/i.test(parameter.name) && status === "novo"
              ? `${parameter.name} esperada no final de ${year.year}`
              : /fatura/i.test(parameter.name)
                ? `${parameter.name} de ${year.year - 1}`
                : parameter.name;
          if (parameter.kind === "opcao") {
            return (
              <label key={parameter.id} className="text-sm">
                {caption}
                <select
                  className={input}
                  value={current?.valueId ?? ""}
                  onChange={(event) =>
                    setSelected((map) => ({
                      ...map,
                      [parameter.id]: { valueId: Number(event.target.value), numeric: current?.numeric ?? "" },
                    }))
                  }
                >
                  {parameter.values.map((value) => (
                    <option key={value.id} value={value.id}>
                      {value.label} ({value.amount === 0 ? "incluído na base" : `${value.amount > 0 ? "+" : ""}${eur(value.amount)}`})
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label key={parameter.id} className="text-sm">
              {caption}
              <input
                className={input}
                inputMode="decimal"
                value={current?.numeric ?? ""}
                onChange={(event) =>
                  setSelected((map) => ({
                    ...map,
                    [parameter.id]: { valueId: null, numeric: event.target.value },
                  }))
                }
              />
            </label>
          );
        })}
        <label className="text-sm md:col-span-2">
          Ajuste manual (€ por {periodLabel(period)}, negativo para desconto)
          <input className={input} inputMode="decimal" value={manual} placeholder="0" onChange={(event) => setManual(event.target.value)} />
        </label>
      </div>
      <div className="mt-5 overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr className="border-b border-line">
              <td className="px-3 py-2">Avença base</td>
              <td className="px-3 py-2 text-right tabular-nums">{eur(quote.base)}</td>
            </tr>
            {quote.parts.map((part) => (
              <tr key={part.label} className="border-b border-line">
                <td className="px-3 py-2">
                  {part.label}
                  <span className="mt-0.5 block text-xs text-muted">{part.detail}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {part.amount > 0 ? "+" : ""}
                  {eur(part.amount)}
                </td>
              </tr>
            ))}
            <tr className="bg-paper">
              <td className="px-3 py-3 font-medium text-navy">Avença por {periodLabel(period)}</td>
              <td className="px-3 py-3 text-right font-serif text-xl text-navy tabular-nums">{eur(quote.periodAmount)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-muted">Equivalente anual (× {period === "trimestral" ? 4 : 12})</td>
              <td className="px-3 py-2 text-right tabular-nums">{eur(quote.annual)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="rounded-md bg-navy px-4 py-2 text-sm text-white disabled:opacity-60">
          {pending ? "A guardar…" : "Guardar e aplicar à avença base"}
        </button>
        {message ? <p className="text-sm text-navy">{message}</p> : null}
      </div>
    </section>
  );
}
