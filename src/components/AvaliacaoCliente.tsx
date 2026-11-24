"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAvaliacao } from "@/app/actions";
import {
  NIVEIS_CONTABILIZACAO,
  NIVEIS_ORGANIZACAO,
  calcularAvencaTeorica,
  calcularRevisaoAvenca,
  type ConfiguracaoAvencas,
  type DadosAnuais,
} from "@/lib/avenca-motor";
import { eur, parseDecimal } from "@/lib/format";

const field = "space-y-1 text-sm";
const input = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";

type Draft = {
  faturacao: string;
  documentos: string;
  organizacao: string;
  contabilizacao: string;
};

function texto(value: number | null): string {
  return value == null ? "" : String(value).replace(".", ",");
}

function lerDados(draft: Draft): DadosAnuais | null {
  const faturacao = parseDecimal(draft.faturacao);
  const documentos = parseDecimal(draft.documentos);
  const organizacao = Number(draft.organizacao);
  const contabilizacao = Number(draft.contabilizacao);
  if (faturacao == null || documentos == null || !Number.isInteger(documentos)) return null;
  if (!Number.isInteger(organizacao) || organizacao < 1 || !Number.isInteger(contabilizacao) || contabilizacao < 1) return null;
  return { faturacao, documentos, organizacao, contabilizacao };
}

function percentagem(value: number): string {
  return `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(value)} %`;
}

export function AvaliacaoCliente({
  clientId,
  year,
  avencaAnterior,
  config,
  atual,
  anterior,
  approvalStatus,
  approvedRetainer,
}: {
  clientId: number;
  year: number;
  avencaAnterior: number | null;
  config: ConfiguracaoAvencas;
  atual: { faturacao: number | null; documentos: number | null; organizacao: number | null; contabilizacao: number | null };
  anterior: { faturacao: number | null; documentos: number | null; organizacao: number | null; contabilizacao: number | null };
  approvalStatus: "rascunho" | "aprovada" | "rejeitada";
  approvedRetainer: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [draftAtual, setDraftAtual] = useState<Draft>({
    faturacao: texto(atual.faturacao),
    documentos: texto(atual.documentos),
    organizacao: atual.organizacao == null ? "" : String(atual.organizacao),
    contabilizacao: atual.contabilizacao == null ? "" : String(atual.contabilizacao),
  });
  const [draftAnterior, setDraftAnterior] = useState<Draft>({
    faturacao: texto(anterior.faturacao),
    documentos: texto(anterior.documentos),
    organizacao: anterior.organizacao == null ? "" : String(anterior.organizacao),
    contabilizacao: anterior.contabilizacao == null ? "" : String(anterior.contabilizacao),
  });

  const dadosAtuais = lerDados(draftAtual);
  const dadosAnteriores = lerDados(draftAnterior);
  let calcError = "";
  let teorica: ReturnType<typeof calcularAvencaTeorica> | null = null;
  let revisao: ReturnType<typeof calcularRevisaoAvenca> | null = null;
  if (!dadosAtuais || !dadosAnteriores) {
    calcError = "Preencha a faturação, o volume documental e os níveis de 1 a 6 nos dois exercícios.";
  } else {
    try {
      teorica = calcularAvencaTeorica(dadosAtuais, config);
      if (avencaAnterior != null && avencaAnterior > 0) {
        revisao = calcularRevisaoAvenca(avencaAnterior, dadosAnteriores, dadosAtuais, config);
      }
    } catch (caught) {
      calcError = caught instanceof Error ? caught.message : "Dados inválidos.";
    }
  }

  function save(decisao: "guardar" | "aprovar" | "rejeitar") {
    if (!dadosAtuais || !dadosAnteriores) {
      setError(calcError);
      return;
    }
    setError("");
    setMessage("");
    startTransition(async () => {
      const result = await saveAvaliacao({
        clientId,
        year,
        atual: dadosAtuais,
        anterior: dadosAnteriores,
        decisao,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        decisao === "aprovar"
          ? `Proposta aprovada: ${eur(result.amount ?? 0)} por mês.`
          : decisao === "rejeitar"
            ? "Proposta rejeitada."
            : "Avaliação guardada.",
      );
      router.refresh();
    });
  }

  const organizacao = NIVEIS_ORGANIZACAO.find((nivel) => nivel.value === Number(draftAtual.organizacao));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-serif text-2xl text-navy">Avaliação e avenças</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Compara {year - 1} com {year}. A avença teórica sai do rating. A revisão aplica a inflação e, acima da tolerância, o crescimento e a complexidade.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AnoCampos titulo={String(year - 1)} draft={draftAnterior} onChange={setDraftAnterior} />
        <AnoCampos titulo={String(year)} draft={draftAtual} onChange={setDraftAtual} />
      </div>
      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted">Organização em {year}</span>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-navy">
            <span className="h-3 w-3 rounded-full" style={{ background: organizacao?.color ?? "#94a3b8" }} />
            {organizacao?.label}
          </span>
          <span className="text-sm text-muted">
            Aprovação: {approvalStatus === "aprovada" ? "aprovada" : approvalStatus === "rejeitada" ? "rejeitada" : "por aprovar"}
            {approvedRetainer != null ? ` · ${eur(approvedRetainer)}` : ""}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">
          Avença praticada em {year - 1}: {avencaAnterior == null ? "por lançar no histórico" : eur(avencaAnterior)}
        </p>
        {calcError ? <p className="mt-3 text-sm text-[#8d2f39]">{calcError}</p> : null}
        {teorica ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metrica titulo="Rating" valor={`${teorica.rating.toLocaleString("pt-PT")} · ${teorica.classificacao}`} />
            <Metrica titulo="Complexidade" valor={percentagem(teorica.complexidadePercentual)} />
            <Metrica titulo="Avença teórica" valor={eur(teorica.avencaTeorica)} />
          </dl>
        ) : null}
        {revisao && revisao.avencaProposta != null && revisao.avencaArredondada != null ? (
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metrica titulo="Atividade" valor={`${revisao.classificacaoAtividade} · ${percentagem(revisao.variacaoAtividade)}`} />
            <Metrica titulo="Faturação" valor={percentagem(revisao.variacaoFaturacao)} />
            <Metrica titulo="Documentos" valor={percentagem(revisao.variacaoDocumentos)} />
            <Metrica titulo="Inflação" valor={percentagem(revisao.inflacao)} />
            <Metrica titulo="Ajuste de crescimento" valor={percentagem(revisao.ajusteAtividade)} />
            <Metrica titulo="Ajuste de complexidade" valor={percentagem(revisao.ajusteComplexidade)} />
            <Metrica titulo="Atualização" valor={percentagem(revisao.atualizacaoTotal)} />
            <Metrica titulo="Proposta" valor={eur(revisao.avencaProposta)} />
            <Metrica titulo="Arredondada" valor={eur(revisao.avencaArredondada)} />
            <Metrica titulo="Aumento mensal" valor={eur(revisao.aumentoMensal)} />
            <Metrica titulo="Aumento anual" valor={eur(revisao.aumentoAnual)} />
            <Metrica titulo="Face à teórica" valor={eur(revisao.diferencaAvencaTeorica)} />
          </dl>
        ) : null}
        {revisao && revisao.avencaProposta == null ? (
          <p className="mt-3 text-sm text-[#8d2f39]">{revisao.motivo}</p>
        ) : null}
        {revisao && revisao.avencaProposta != null && revisao.revisaoManual ? (
          <p className="mt-3 text-sm text-[#8d2f39]">Esta variação pede aprovação manual antes de seguir.</p>
        ) : null}
        {revisao && revisao.avencaProposta != null && revisao.apenasInflacao ? (
          <p className="mt-3 text-sm text-navy">A atividade manteve-se dentro da tolerância. A proposta leva só a inflação.</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => save("guardar")} className="rounded-md border border-navy px-4 py-2 text-sm text-navy">
            Guardar avaliação
          </button>
          <button type="button" disabled={pending || revisao?.avencaProposta == null} onClick={() => save("aprovar")} className="rounded-md bg-navy px-4 py-2 text-sm text-white">
            Aprovar proposta
          </button>
          <button type="button" disabled={pending} onClick={() => save("rejeitar")} className="rounded-md px-4 py-2 text-sm text-[#8d2f39]">
            Rejeitar
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-navy">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-[#8d2f39]">{error}</p> : null}
      </div>
    </section>
  );
}

function AnoCampos({
  titulo,
  draft,
  onChange,
}: {
  titulo: string;
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  function set(key: keyof Draft, value: string) {
    onChange({ ...draft, [key]: value });
  }
  return (
    <div className="space-y-3 rounded-xl border border-line bg-card p-4">
      <h3 className="font-serif text-xl text-navy">{titulo}</h3>
      <label className={field}>
        Faturação anual (€)
        <input className={input} inputMode="decimal" value={draft.faturacao} onChange={(event) => set("faturacao", event.target.value)} />
      </label>
      <label className={field}>
        Volume documental
        <input className={input} inputMode="numeric" value={draft.documentos} onChange={(event) => set("documentos", event.target.value)} />
      </label>
      <label className={field}>
        Organização
        <select className={input} value={draft.organizacao} onChange={(event) => set("organizacao", event.target.value)}>
          <option value="">Escolher</option>
          {NIVEIS_ORGANIZACAO.map((nivel) => (
            <option key={nivel.value} value={nivel.value}>{nivel.value} · {nivel.label}</option>
          ))}
        </select>
      </label>
      <label className={field}>
        Contabilização
        <select className={input} value={draft.contabilizacao} onChange={(event) => set("contabilizacao", event.target.value)}>
          <option value="">Escolher</option>
          {NIVEIS_CONTABILIZACAO.map((nivel) => (
            <option key={nivel.value} value={nivel.value}>{nivel.value} · {nivel.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Metrica({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted">{titulo}</dt>
      <dd className="mt-1 text-sm font-medium text-navy">{valor}</dd>
    </div>
  );
}
