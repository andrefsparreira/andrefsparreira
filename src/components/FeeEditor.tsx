"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveYearLines } from "@/app/actions";
import { CompositionChart, RuChart } from "@/components/Charts";
import { HonorariosTable } from "@/components/HonorariosTable";
import { eur, INCLUSION_LABEL, parseDecimal, PERIOD_LABEL, RULE_LABEL } from "@/lib/format";
import { ANNUAL_UPDATE_MONTHLY, computeSummary, monthlyRunRate, suggestMonthlyUpdate } from "@/lib/pricing";
import type { FeeLine, Inclusion, LineDraft, Periodicity, ServiceType } from "@/lib/types";

type Draft = LineDraft & { key: string };

const input = "w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-navy";

function toDraft(line: FeeLine): Draft {
  return {
    key: `line-${line.id}`,
    typeCode: line.typeCode,
    description: line.description,
    periodicity: line.periodicity,
    quantity: line.quantity,
    inclusion: line.inclusion,
    optional: line.optional,
    unitValue: line.unitValue,
    manual: line.manual,
    pricingRule: line.pricingRule,
    notes: line.notes,
  };
}

export function FeeEditor({
  yearId,
  lines,
  types,
  vatRate,
  employees,
}: {
  yearId: number;
  lines: FeeLine[];
  types: ServiceType[];
  vatRate: number;
  employees: number;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(() => lines.map(toDraft));
  const [vatPercent, setVatPercent] = useState(String(Math.round(vatRate * 10000) / 100).replace(".", ","));
  const [ipc, setIpc] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const parsedVat = (parseDecimal(vatPercent) ?? 23) / 100;
  const summary = useMemo(() => computeSummary(drafts, parsedVat), [drafts, parsedVat]);
  const monthly = monthlyRunRate(summary);
  const ipcRate = ipc.trim() === "" ? null : (parseDecimal(ipc) ?? 0) / 100;
  const update = suggestMonthlyUpdate(monthly, ipcRate);
  const ruLine = drafts.find((line) => line.pricingRule === "ru_tier");

  function patch(key: string, partial: Partial<Draft>) {
    setDrafts((current) => current.map((line) => (line.key === key ? { ...line, ...partial } : line)));
  }

  function changeType(key: string, code: string) {
    const type = types.find((item) => item.code === code);
    if (!type) return;
    setDrafts((current) =>
      current.map((line) => {
        if (line.key !== key) return line;
        const previous = types.find((item) => item.code === line.typeCode);
        const description =
          !line.description.trim() || line.description === previous?.label ? type.label : line.description;
        let quantity = line.quantity;
        if (type.pricingRule === "payroll" || type.pricingRule === "ru_tier") quantity = employees;
        if (type.pricingRule === "per_occurrence" && quantity == null) quantity = 0;
        return {
          ...line,
          typeCode: type.code,
          description,
          periodicity: type.defaultPeriodicity,
          inclusion: type.defaultInclusion,
          optional: type.defaultOptional,
          unitValue: type.defaultUnitValue,
          pricingRule: type.pricingRule,
          manual: false,
          quantity,
        };
      }),
    );
  }

  function addLine() {
    const type = types[0];
    if (!type) return;
    setDrafts((current) => [
      ...current,
      {
        key: `new-${crypto.randomUUID()}`,
        typeCode: type.code,
        description: type.label,
        periodicity: type.defaultPeriodicity,
        quantity: null,
        inclusion: type.defaultInclusion,
        optional: type.defaultOptional,
        unitValue: type.defaultUnitValue,
        manual: false,
        pricingRule: type.pricingRule,
        notes: "",
      },
    ]);
  }

  function move(index: number, direction: -1 | 1) {
    setDrafts((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(target, 0, item);
      return next;
    });
  }

  function applyUpdate() {
    setDrafts((current) => {
      const index = current.findIndex(
        (line) => line.periodicity === "mensal" && line.inclusion === "valor" && !line.optional,
      );
      if (index < 0) return current;
      const next = [...current];
      const line = next[index];
      if (!line) return current;
      next[index] = {
        ...line,
        manual: true,
        inclusion: "valor",
        unitValue: Math.round(((line.unitValue ?? 0) + update.applied) * 100) / 100,
        notes: line.notes || "Atualização anual aplicada sobre a avença mensal.",
      };
      return next;
    });
    setMessage("Atualização lançada na primeira linha mensal. Guarde a avença para a fixar.");
  }

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await saveYearLines({
        yearId,
        vatRate: parsedVat,
        lines: drafts.map(({ key: _key, ...line }) => line),
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Avença guardada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-2 py-2">Tipo</th>
              <th className="px-2 py-2">Descrição</th>
              <th className="px-2 py-2">Periodicidade</th>
              <th className="px-2 py-2">Qtd. / escalão</th>
              <th className="px-2 py-2">Valor</th>
              <th className="px-2 py-2">Inclusão</th>
              <th className="px-2 py-2">Notas</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((line, index) => (
              <tr key={line.key} className="border-t border-line align-top">
                <td className="px-2 py-2">
                  <select className={input} value={line.typeCode} onChange={(event) => changeType(line.key, event.target.value)}>
                    {types.map((type) => (
                      <option key={type.code} value={type.code}>{type.label}</option>
                    ))}
                    {!types.some((type) => type.code === line.typeCode) ? (
                      <option value={line.typeCode}>{line.typeCode}</option>
                    ) : null}
                  </select>
                  <div className="mt-1 text-xs text-muted">{RULE_LABEL[line.pricingRule]}</div>
                </td>
                <td className="px-2 py-2">
                  <input className={input} value={line.description} onChange={(event) => patch(line.key, { description: event.target.value })} />
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={line.optional} onChange={(event) => patch(line.key, { optional: event.target.checked })} />
                    Opcional
                  </label>
                </td>
                <td className="px-2 py-2">
                  <select
                    className={input}
                    value={line.periodicity}
                    onChange={(event) => patch(line.key, { periodicity: event.target.value as Periodicity })}
                  >
                    {Object.entries(PERIOD_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input
                    className={input}
                    value={line.quantity ?? ""}
                    onChange={(event) => patch(line.key, { quantity: parseDecimal(event.target.value) })}
                    placeholder={line.pricingRule === "ru_tier" ? "colaboradores" : "quantidade"}
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    className={input}
                    value={line.unitValue ?? ""}
                    onChange={(event) => patch(line.key, { unitValue: parseDecimal(event.target.value), manual: true })}
                    placeholder="€"
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" checked={line.manual} onChange={(event) => patch(line.key, { manual: event.target.checked })} />
                    Valor manual
                  </label>
                </td>
                <td className="px-2 py-2">
                  <select
                    className={input}
                    value={line.inclusion}
                    onChange={(event) => patch(line.key, { inclusion: event.target.value as Inclusion })}
                  >
                    {Object.entries(INCLUSION_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2">
                  <input className={input} value={line.notes} onChange={(event) => patch(line.key, { notes: event.target.value })} />
                </td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <button type="button" className="mr-1 text-xs text-navy" onClick={() => move(index, -1)}>Subir</button>
                  <button type="button" className="mr-1 text-xs text-navy" onClick={() => move(index, 1)}>Descer</button>
                  <button type="button" className="text-xs text-[#8d2f39]" onClick={() => setDrafts((current) => current.filter((item) => item.key !== line.key))}>
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addLine} className="rounded-md border border-navy px-3 py-2 text-sm text-navy">
          Adicionar linha
        </button>
        <button type="button" onClick={save} disabled={pending} className="rounded-md bg-navy px-3 py-2 text-sm text-white disabled:opacity-60">
          {pending ? "A guardar…" : "Guardar avença"}
        </button>
        {message ? <p className="self-center text-sm text-navy">{message}</p> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-line bg-card p-4">
          <h3 className="font-serif text-xl text-navy">Resumo anual</h3>
          <p className="mb-4 mt-1 text-sm text-muted">
            A taxa de IVA é a taxa legal em vigor. O modelo só diz «à taxa legal»; 23% é a taxa normal do continente e pode ser alterada.
          </p>
          <label className="mb-4 block max-w-xs text-sm">
            Taxa de IVA (%)
            <input className={`${input} mt-1`} value={vatPercent} onChange={(event) => setVatPercent(event.target.value)} />
          </label>
          <HonorariosTable summary={summary} />
        </div>
        <div className="space-y-4">
          <CompositionChart summary={summary} />
          <RuChart headcount={ruLine?.quantity ?? null} />
          <div className="rounded-xl border border-line bg-card p-4 text-sm">
            <h3 className="font-serif text-lg text-navy">Atualização anual</h3>
            <p className="mt-1 text-muted">
              Base de {eur(ANNUAL_UPDATE_MONTHLY)} + IVA por mês sobre a avença mensal corrente ({eur(monthly)}), ou a variação do IPC se o aumento for superior.
            </p>
            <label className="mt-3 block">
              Variação do IPC (%)
              <input className={`${input} mt-1`} value={ipc} onChange={(event) => setIpc(event.target.value)} placeholder="vazio para usar só os 10 €" />
            </label>
            <p className="mt-3">
              Atualização sugerida: <strong>{eur(update.applied)} / mês</strong>
              {update.basis === "ipc" ? " (IPC)" : " (base de 10 €)"}.
            </p>
            <button type="button" onClick={applyUpdate} className="mt-3 rounded-md border border-navy px-3 py-2 text-navy">
              Lançar na linha mensal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
