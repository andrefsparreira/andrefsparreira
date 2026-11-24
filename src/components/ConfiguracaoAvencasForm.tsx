"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAvencaConfig } from "@/app/actions";
import type { ConfiguracaoAvencas } from "@/lib/avenca-motor";
import { eur } from "@/lib/format";

type Chave = keyof Omit<ConfiguracaoAvencas, "avencasReferencia">;

const CAMPOS: { key: Chave; label: string; min: number; max: number; step: number; kind: "percent" | "peso" | "euro" }[] = [
  { key: "inflacao", label: "Inflação", min: 0, max: 20, step: 0.1, kind: "percent" },
  { key: "tolerancia", label: "Tolerância", min: 0, max: 50, step: 0.5, kind: "percent" },
  { key: "pesoOrganizacao", label: "Peso da organização", min: 0, max: 1, step: 0.01, kind: "peso" },
  { key: "pesoContabilizacao", label: "Peso da contabilização", min: 0, max: 1, step: 0.01, kind: "peso" },
  { key: "pesoFaturacao", label: "Peso da faturação", min: 0, max: 1, step: 0.01, kind: "peso" },
  { key: "pesoDocumentos", label: "Peso dos documentos", min: 0, max: 1, step: 0.01, kind: "peso" },
  { key: "impactoCrescimento", label: "Impacto do crescimento", min: 0, max: 1, step: 0.01, kind: "peso" },
  { key: "impactoComplexidade", label: "Impacto da complexidade", min: 0, max: 1, step: 0.01, kind: "peso" },
  { key: "arredondamento", label: "Arredondamento", min: 1, max: 50, step: 1, kind: "euro" },
  { key: "avencaMaximaReferencia", label: "Avença máxima de referência", min: 0, max: 2000, step: 5, kind: "euro" },
];

function mostrar(kind: "percent" | "peso" | "euro", value: number): string {
  if (kind === "euro") return eur(value);
  const texto = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(value);
  return kind === "percent" ? `${texto} %` : texto;
}

function teto(valor: number, max: number): number {
  return Math.max(max, valor);
}

export function ConfiguracaoAvencasForm({ config }: { config: ConfiguracaoAvencas }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [valores, setValores] = useState<ConfiguracaoAvencas>(() => ({
    ...config,
    avencasReferencia: [...config.avencasReferencia],
  }));

  function setCampo(key: Chave, value: number) {
    setValores((atual) => ({ ...atual, [key]: value }));
  }

  function setReferencia(index: number, value: number) {
    setValores((atual) => {
      const avencasReferencia = [...atual.avencasReferencia];
      avencasReferencia[index] = value;
      return { ...atual, avencasReferencia };
    });
  }

  function save() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await saveAvencaConfig(valores);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Configuração guardada. Vale para todos os clientes.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6 rounded-xl border border-line bg-card p-4">
      <div className="grid gap-5 md:grid-cols-2">
        {CAMPOS.map((campo) => (
          <Barra
            key={campo.key}
            label={campo.label}
            min={campo.min}
            max={teto(valores[campo.key], campo.max)}
            step={campo.step}
            value={valores[campo.key]}
            texto={mostrar(campo.kind, valores[campo.key])}
            onChange={(value) => setCampo(campo.key, value)}
          />
        ))}
      </div>
      <div>
        <h3 className="font-serif text-xl text-navy">Avenças de referência</h3>
        <p className="mt-1 text-sm text-muted">Seis patamares, do nível 1 ao nível 6, usados na interpolação da avença teórica.</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          {valores.avencasReferencia.map((valor, index) => (
            <Barra
              key={index}
              label={`Nível ${index + 1}`}
              min={0}
              max={teto(valor, 2000)}
              step={5}
              value={valor}
              texto={eur(valor)}
              onChange={(value) => setReferencia(index, value)}
            />
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

function Barra({
  label,
  min,
  max,
  step,
  value,
  texto,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  texto: string;
  onChange: (value: number) => void;
}) {
  const alcance = max - min || 1;
  const percentagem = Math.min(100, Math.max(0, ((value - min) / alcance) * 100));
  return (
    <label className="block text-sm">
      <span className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-navy">{texto}</span>
      </span>
      <input
        type="range"
        className="barra mt-3 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        style={{ background: `linear-gradient(to right, #002060 ${percentagem}%, #e4ddd2 ${percentagem}%)` }}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
