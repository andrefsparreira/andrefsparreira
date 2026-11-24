"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAvencaConfig } from "@/app/actions";
import type { ConfiguracaoAvencas } from "@/lib/avenca-motor";
import { parseDecimal } from "@/lib/format";

const input = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";

const CAMPOS: { key: keyof Omit<ConfiguracaoAvencas, "avencasReferencia">; label: string }[] = [
  { key: "inflacao", label: "Inflação (%)" },
  { key: "tolerancia", label: "Tolerância (%)" },
  { key: "pesoOrganizacao", label: "Peso da organização" },
  { key: "pesoContabilizacao", label: "Peso da contabilização" },
  { key: "pesoFaturacao", label: "Peso da faturação" },
  { key: "pesoDocumentos", label: "Peso dos documentos" },
  { key: "impactoCrescimento", label: "Impacto do crescimento" },
  { key: "impactoComplexidade", label: "Impacto da complexidade" },
  { key: "arredondamento", label: "Arredondamento (€)" },
  { key: "avencaMaximaReferencia", label: "Avença máxima de referência (€)" },
];

export function ConfiguracaoAvencasForm({ config }: { config: ConfiguracaoAvencas }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const campo of CAMPOS) initial[campo.key] = String(config[campo.key]).replace(".", ",");
    config.avencasReferencia.forEach((valor, index) => {
      initial[`ref${index}`] = String(valor).replace(".", ",");
    });
    return initial;
  });

  function save() {
    setMessage("");
    setError("");
    const numeros: Record<string, number> = {};
    for (const campo of CAMPOS) {
      const valor = parseDecimal(values[campo.key] ?? "");
      if (valor == null) {
        setError(`Indique um número em «${campo.label}».`);
        return;
      }
      numeros[campo.key] = valor;
    }
    const avencasReferencia = [0, 1, 2, 3, 4, 5].map((index) => parseDecimal(values[`ref${index}`] ?? ""));
    if (avencasReferencia.some((valor) => valor == null)) {
      setError("Indique as seis avenças de referência.");
      return;
    }
    startTransition(async () => {
      const result = await saveAvencaConfig({
        inflacao: numeros.inflacao,
        tolerancia: numeros.tolerancia,
        pesoOrganizacao: numeros.pesoOrganizacao,
        pesoContabilizacao: numeros.pesoContabilizacao,
        pesoFaturacao: numeros.pesoFaturacao,
        pesoDocumentos: numeros.pesoDocumentos,
        impactoCrescimento: numeros.impactoCrescimento,
        impactoComplexidade: numeros.impactoComplexidade,
        arredondamento: numeros.arredondamento,
        avencaMaximaReferencia: numeros.avencaMaximaReferencia,
        avencasReferencia: avencasReferencia as number[],
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Configuração guardada. Vale para todos os clientes.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-line bg-card p-4">
      <div className="grid gap-3 md:grid-cols-2">
        {CAMPOS.map((campo) => (
          <label key={campo.key} className="text-sm">
            {campo.label}
            <input className={input} inputMode="decimal" value={values[campo.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [campo.key]: event.target.value }))} />
          </label>
        ))}
      </div>
      <div>
        <h3 className="font-serif text-xl text-navy">Avenças de referência</h3>
        <p className="mt-1 text-sm text-muted">Seis patamares, do nível 1 ao nível 6, usados na interpolação da avença teórica.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <label key={index} className="text-sm">
              Nível {index + 1} (€)
              <input className={input} inputMode="decimal" value={values[`ref${index}`] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [`ref${index}`]: event.target.value }))} />
            </label>
          ))}
        </div>
      </div>
      <button type="button" disabled={pending} onClick={save} className="rounded-md bg-navy px-4 py-2 text-sm text-white">
        Guardar configuração
      </button>
      {message ? <p className="text-sm text-navy">{message}</p> : null}
      {error ? <p className="text-sm text-[#8d2f39]">{error}</p> : null}
    </div>
  );
}
