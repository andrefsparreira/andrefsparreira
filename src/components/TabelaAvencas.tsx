"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { aceitaFiltro, type LinhaQuadro } from "@/lib/avenca-quadro";
import { eur } from "@/lib/format";

type Ordenacao = "name" | "rating" | "avencaProposta" | "variacaoAtividade" | "approvalStatus";

export function TabelaAvencas({ linhas, ano }: { linhas: LinhaQuadro[]; ano: number }) {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("todos");
  const [ordem, setOrdem] = useState<Ordenacao>("name");
  const [sentido, setSentido] = useState<"asc" | "desc">("asc");

  const visiveis = useMemo(() => {
    const filtradas = linhas.filter((linha) => aceitaFiltro(linha, { q, estado }));
    const fator = sentido === "asc" ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      const esquerda = a[ordem];
      const direita = b[ordem];
      if (typeof esquerda === "string" && typeof direita === "string") return esquerda.localeCompare(direita, "pt") * fator;
      const x = typeof esquerda === "number" ? esquerda : Number.NEGATIVE_INFINITY;
      const y = typeof direita === "number" ? direita : Number.NEGATIVE_INFINITY;
      return (x - y) * fator;
    });
  }, [linhas, q, estado, ordem, sentido]);

  function ordenar(coluna: Ordenacao) {
    if (ordem === coluna) {
      setSentido((atual) => (atual === "asc" ? "desc" : "asc"));
      return;
    }
    setOrdem(coluna);
    setSentido(coluna === "name" ? "asc" : "desc");
  }

  const exportar = `/api/avencas/excel?ano=${ano}&q=${encodeURIComponent(q)}&estado=${encodeURIComponent(estado)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Cliente
          <input value={q} onChange={(event) => setQ(event.target.value)} className="mt-1 block rounded-md border border-line px-3 py-2" placeholder="Nome" />
        </label>
        <label className="text-sm">
          Estado
          <select value={estado} onChange={(event) => setEstado(event.target.value)} className="mt-1 block rounded-md border border-line bg-white px-3 py-2">
            <option value="todos">Todos</option>
            <option value="rascunho">Por aprovar</option>
            <option value="aprovada">Aprovadas</option>
            <option value="rejeitada">Rejeitadas</option>
            <option value="manual">Revisão manual</option>
            <option value="incompleta">Por preencher</option>
          </select>
        </label>
        <a href={exportar} className="rounded-md border border-navy px-4 py-2 text-sm text-navy">
          Exportar Excel
        </a>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <Th onClick={() => ordenar("name")}>Cliente</Th>
              <th className="px-3 py-2">Faturação</th>
              <th className="px-3 py-2">Documentos</th>
              <Th onClick={() => ordenar("rating")}>Rating</Th>
              <Th onClick={() => ordenar("avencaProposta")}>Proposta</Th>
              <Th onClick={() => ordenar("variacaoAtividade")}>Atividade</Th>
              <Th onClick={() => ordenar("approvalStatus")}>Aprovação</Th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((linha) => (
              <tr key={linha.clientId} className="border-t border-line">
                <td className="px-3 py-2">
                  <Link href={`/clientes/${linha.clientId}?ano=${linha.year}&sep=avaliacao`} className="text-navy underline">
                    {linha.name}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{par(linha.faturacaoAnterior, linha.faturacao)}</td>
                <td className="px-3 py-2 tabular-nums">{par(linha.documentosAnterior, linha.documentos)}</td>
                <td className="px-3 py-2">{linha.rating == null ? "—" : `${linha.rating.toLocaleString("pt-PT")} · ${linha.classificacao}`}</td>
                <td className="px-3 py-2 tabular-nums">{linha.avencaArredondada == null ? "—" : eur(linha.avencaArredondada)}</td>
                <td className="px-3 py-2">{linha.classificacaoAtividade || linha.motivo || "—"}</td>
                <td className="px-3 py-2">
                  {linha.approvalStatus === "aprovada" ? "Aprovada" : linha.approvalStatus === "rejeitada" ? "Rejeitada" : "Por aprovar"}
                  {linha.revisaoManual ? " · manual" : ""}
                </td>
              </tr>
            ))}
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-muted">Nenhum cliente com este filtro.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <th className="px-3 py-2">
      <button type="button" onClick={onClick} className="uppercase tracking-wide">
        {children}
      </button>
    </th>
  );
}

function par(anterior: number | null, atual: number | null): string {
  const formato = (valor: number | null) => (valor == null ? "—" : new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 0 }).format(valor));
  return `${formato(anterior)} → ${formato(atual)}`;
}
