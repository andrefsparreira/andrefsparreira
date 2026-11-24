"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRetainerCatalog } from "@/app/actions";
import { parseDecimal } from "@/lib/format";
import type { RetainerKind, RetainerParameter } from "@/lib/types";

const input = "w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm outline-none focus:border-navy";

type DraftValue = {
  key: string;
  id: number | null;
  label: string;
  amount: string;
  rangeMin: string;
  rangeMax: string;
};

type DraftParameter = {
  key: string;
  id: number | null;
  name: string;
  kind: RetainerKind;
  values: DraftValue[];
};

function money(amount: number): string {
  return String(amount).replace(".", ",");
}

function fromCatalog(parameters: RetainerParameter[]): DraftParameter[] {
  return parameters.map((parameter) => ({
    key: `p-${parameter.id}`,
    id: parameter.id,
    name: parameter.name,
    kind: parameter.kind,
    values: parameter.values.map((value) => ({
      key: `v-${value.id}`,
      id: value.id,
      label: value.label,
      amount: money(value.amount),
      rangeMin: value.rangeMin == null ? "" : money(value.rangeMin),
      rangeMax: value.rangeMax == null ? "" : money(value.rangeMax),
    })),
  }));
}

function blankValue(): DraftValue {
  return { key: `new-${crypto.randomUUID()}`, id: null, label: "", amount: "0", rangeMin: "", rangeMax: "" };
}

export function RetainerParameters({
  baseAmount,
  parameters,
}: {
  baseAmount: number;
  parameters: RetainerParameter[];
}) {
  const router = useRouter();
  const [base, setBase] = useState(money(baseAmount));
  const [draft, setDraft] = useState<DraftParameter[]>(() => fromCatalog(parameters));
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function patchParameter(key: string, partial: Partial<DraftParameter>) {
    setDraft((current) => current.map((parameter) => (parameter.key === key ? { ...parameter, ...partial } : parameter)));
  }

  function patchValue(parameterKey: string, valueKey: string, partial: Partial<DraftValue>) {
    setDraft((current) =>
      current.map((parameter) =>
        parameter.key === parameterKey
          ? {
              ...parameter,
              values: parameter.values.map((value) => (value.key === valueKey ? { ...value, ...partial } : value)),
            }
          : parameter,
      ),
    );
  }

  function save() {
    setMessage("");
    const parsedBase = parseDecimal(base);
    if (parsedBase == null) {
      setMessage("A avença base não é um número.");
      return;
    }
    startTransition(async () => {
      const result = await saveRetainerCatalog({
        baseAmount: parsedBase,
        parameters: draft.map((parameter) => ({
          id: parameter.id,
          name: parameter.name,
          kind: parameter.kind,
          values: parameter.values.map((value) => ({
            id: value.id,
            label: value.label,
            amount: parseDecimal(value.amount) ?? Number.NaN,
            rangeMin: parameter.kind === "escalao" ? parseDecimal(value.rangeMin) : null,
            rangeMax: parameter.kind === "escalao" ? parseDecimal(value.rangeMax) : null,
          })),
        })),
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Parâmetros guardados. O cálculo da avença base usa já estes valores.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-line bg-card p-5">
      <div>
        <h2 className="font-serif text-2xl text-navy">Parâmetros da avença base</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Estes valores entram só no cálculo da avença base, mensal ou trimestral. Pode alterar os montantes, acrescentar
          parâmetros e acrescentar valores a cada parâmetro. Os restantes serviços da proposta não usam esta tabela.
        </p>
      </div>
      <label className="block max-w-xs text-sm">
        Avença base (€)
        <input className={`${input} mt-1`} value={base} onChange={(event) => setBase(event.target.value)} />
      </label>
      {draft.map((parameter) => (
        <div key={parameter.key} className="rounded-xl border border-line bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_16rem_auto]">
            <label className="text-sm">
              Parâmetro
              <input className={`${input} mt-1`} value={parameter.name} onChange={(event) => patchParameter(parameter.key, { name: event.target.value })} />
            </label>
            <label className="text-sm">
              Forma
              <select
                className={`${input} mt-1`}
                value={parameter.kind}
                onChange={(event) => patchParameter(parameter.key, { kind: event.target.value as RetainerKind })}
              >
                <option value="opcao">Lista de opções</option>
                <option value="escalao">Escalões por número</option>
              </select>
            </label>
            <button
              type="button"
              className="self-end text-sm text-[#8d2f39]"
              onClick={() => setDraft((current) => current.filter((item) => item.key !== parameter.key))}
            >
              Remover parâmetro
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-2 py-1">Valor</th>
                  <th className="px-2 py-1">Acréscimo (€)</th>
                  {parameter.kind === "escalao" ? (
                    <>
                      <th className="px-2 py-1">Desde</th>
                      <th className="px-2 py-1">Até</th>
                    </>
                  ) : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {parameter.values.map((value) => (
                  <tr key={value.key} className="border-t border-line">
                    <td className="px-2 py-1">
                      <input className={input} value={value.label} onChange={(event) => patchValue(parameter.key, value.key, { label: event.target.value })} />
                    </td>
                    <td className="px-2 py-1">
                      <input className={input} value={value.amount} onChange={(event) => patchValue(parameter.key, value.key, { amount: event.target.value })} />
                    </td>
                    {parameter.kind === "escalao" ? (
                      <>
                        <td className="px-2 py-1">
                          <input className={input} value={value.rangeMin} placeholder="0" onChange={(event) => patchValue(parameter.key, value.key, { rangeMin: event.target.value })} />
                        </td>
                        <td className="px-2 py-1">
                          <input className={input} value={value.rangeMax} placeholder="sem limite" onChange={(event) => patchValue(parameter.key, value.key, { rangeMax: event.target.value })} />
                        </td>
                      </>
                    ) : null}
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        className="text-xs text-[#8d2f39]"
                        onClick={() =>
                          patchParameter(parameter.key, {
                            values: parameter.values.filter((item) => item.key !== value.key),
                          })
                        }
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            className="mt-3 text-sm text-navy"
            onClick={() => patchParameter(parameter.key, { values: [...parameter.values, blankValue()] })}
          >
            Acrescentar valor
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border border-navy px-3 py-2 text-sm text-navy"
          onClick={() =>
            setDraft((current) => [
              ...current,
              { key: `new-${crypto.randomUUID()}`, id: null, name: "", kind: "opcao", values: [blankValue()] },
            ])
          }
        >
          Acrescentar parâmetro
        </button>
        <button type="button" onClick={save} disabled={pending} className="rounded-md bg-navy px-3 py-2 text-sm text-white disabled:opacity-60">
          {pending ? "A guardar…" : "Guardar parâmetros"}
        </button>
        {message ? <p className="self-center text-sm text-navy">{message}</p> : null}
      </div>
    </section>
  );
}
