"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRetainerHistory } from "@/app/actions";
import { eur, parseDecimal } from "@/lib/format";
import type { RetainerSnapshot } from "@/lib/types";

const input = "w-full rounded-md border border-line bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-navy";

export function RetainerHistory({
  clientId,
  proposalYear,
  rows,
}: {
  clientId: number;
  proposalYear: number;
  rows: RetainerSnapshot[];
}) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<number, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.year, row.monthly == null ? "" : String(row.monthly).replace(".", ",")])),
  );
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const parsed = rows.map((row) => ({ year: row.year, monthly: parseDecimal(amounts[row.year] ?? "") }));
  const max = Math.max(1, ...parsed.map((row) => row.monthly ?? 0));

  function save() {
    setMessage("");
    startTransition(async () => {
      const result = await saveRetainerHistory({ clientId, proposalYear, rows: parsed });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Histórico guardado.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl text-navy">Histórico de avenças</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Avença mensal já praticada nos cinco anos anteriores a {proposalYear}. O valor anual é doze vezes a mensal.
          Anos sem lançamento ficam em branco.
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2">Ano</th>
              <th className="px-3 py-2 text-right">Avença mensal</th>
              <th className="px-3 py-2 text-right">Avença anual</th>
              <th className="px-3 py-2">Evolução</th>
            </tr>
          </thead>
          <tbody>
            {parsed.map((row) => {
              const annual = row.monthly == null ? null : Math.round(row.monthly * 12 * 100) / 100;
              return (
                <tr key={row.year} className="border-t border-line">
                  <td className="px-3 py-2 font-medium text-navy">{row.year}</td>
                  <td className="px-3 py-2">
                    <input
                      className={input}
                      inputMode="decimal"
                      aria-label={`Avença mensal de ${row.year}`}
                      value={amounts[row.year] ?? ""}
                      placeholder="—"
                      onChange={(event) => setAmounts((current) => ({ ...current, [row.year]: event.target.value }))}
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{annual == null ? "—" : eur(annual)}</td>
                  <td className="px-3 py-2">
                    <div className="h-2 rounded-full bg-paper">
                      <div
                        className="h-full rounded-full bg-navy"
                        style={{ width: `${row.monthly == null ? 0 : (row.monthly / max) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-md border border-navy px-3 py-2 text-sm text-navy disabled:opacity-60"
        >
          {pending ? "A guardar…" : "Guardar histórico"}
        </button>
        {message ? <p className="text-sm text-navy">{message}</p> : null}
      </div>
    </section>
  );
}

export function HistorySlide({ rows, proposalYear }: { rows: RetainerSnapshot[]; proposalYear: number }) {
  const max = Math.max(1, ...rows.map((row) => row.monthly ?? 0));
  return (
    <div className="p-8 md:p-10">
      <img src="/brand/ks-logo.png" alt="" className="ml-auto h-7 w-auto" />
      <h2 className="mt-6 font-serif text-3xl text-navy">Avenças já praticadas</h2>
      <p className="mt-3 text-sm text-muted">Valores mensais anteriores à proposta de {proposalYear}.</p>
      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <div key={row.year} className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 text-sm">
            <div className="font-medium text-navy">{row.year}</div>
            <div className="h-3 rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-navy"
                style={{ width: `${row.monthly == null ? 0 : (row.monthly / max) * 100}%` }}
              />
            </div>
            <div className="w-44 text-right tabular-nums">
              {row.monthly == null ? "por lançar" : `${eur(row.monthly)} / mês`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
