import {
  calcularAvencaTeorica,
  calcularRevisaoAvenca,
  type ConfiguracaoAvencas,
  type DadosAnuais,
} from "./avenca-motor";

export type EstadoAprovacao = "rascunho" | "aprovada" | "rejeitada";

export type LinhaQuadro = {
  clientId: number;
  name: string;
  year: number;
  faturacao: number | null;
  faturacaoAnterior: number | null;
  documentos: number | null;
  documentosAnterior: number | null;
  rating: number | null;
  classificacao: string;
  avencaAnterior: number | null;
  avencaTeorica: number | null;
  avencaProposta: number | null;
  avencaArredondada: number | null;
  variacaoAtividade: number | null;
  classificacaoAtividade: string;
  revisaoManual: boolean | null;
  motivo: string;
  approvalStatus: EstadoAprovacao;
  approvedRetainer: number | null;
  incompleta: boolean;
};

export function dadosDe(input: {
  faturacao: number | null;
  documentos: number | null;
  organizacao: number | null;
  contabilizacao: number | null;
}): DadosAnuais | null {
  if (
    input.faturacao == null ||
    input.documentos == null ||
    input.organizacao == null ||
    input.contabilizacao == null
  ) {
    return null;
  }
  return {
    faturacao: input.faturacao,
    documentos: input.documentos,
    organizacao: input.organizacao,
    contabilizacao: input.contabilizacao,
  };
}

export function montarLinha(input: {
  clientId: number;
  name: string;
  year: number;
  atual: {
    faturacao: number | null;
    documentos: number | null;
    organizacao: number | null;
    contabilizacao: number | null;
    approvalStatus: EstadoAprovacao;
    approvedRetainer: number | null;
  } | null;
  anterior: {
    faturacao: number | null;
    documentos: number | null;
    organizacao: number | null;
    contabilizacao: number | null;
  } | null;
  avencaAnterior: number | null;
  config: ConfiguracaoAvencas;
}): LinhaQuadro {
  const atual = input.atual;
  const base: LinhaQuadro = {
    clientId: input.clientId,
    name: input.name,
    year: input.year,
    faturacao: atual?.faturacao ?? null,
    faturacaoAnterior: input.anterior?.faturacao ?? null,
    documentos: atual?.documentos ?? null,
    documentosAnterior: input.anterior?.documentos ?? null,
    rating: null,
    classificacao: "",
    avencaAnterior: input.avencaAnterior,
    avencaTeorica: null,
    avencaProposta: null,
    avencaArredondada: null,
    variacaoAtividade: null,
    classificacaoAtividade: "",
    revisaoManual: null,
    motivo: "",
    approvalStatus: atual?.approvalStatus ?? "rascunho",
    approvedRetainer: atual?.approvedRetainer ?? null,
    incompleta: true,
  };
  const dadosAtuais = atual ? dadosDe(atual) : null;
  const dadosAnteriores = input.anterior ? dadosDe(input.anterior) : null;
  if (!dadosAtuais) return base;
  try {
    const teorica = calcularAvencaTeorica(dadosAtuais, input.config);
    base.rating = teorica.rating;
    base.classificacao = teorica.classificacao;
    base.avencaTeorica = teorica.avencaTeorica;
    base.incompleta = false;
  } catch (error) {
    base.motivo = error instanceof Error ? error.message : "Dados inválidos.";
    return base;
  }
  if (!dadosAnteriores || input.avencaAnterior == null) {
    base.motivo = "Falta o exercício anterior ou a avença praticada.";
    return base;
  }
  try {
    const revisao = calcularRevisaoAvenca(input.avencaAnterior, dadosAnteriores, dadosAtuais, input.config);
    if (revisao.avencaProposta == null) {
      base.revisaoManual = true;
      base.motivo = "motivo" in revisao ? String(revisao.motivo) : "";
      return base;
    }
    base.avencaProposta = revisao.avencaProposta;
    base.avencaArredondada = revisao.avencaArredondada;
    base.variacaoAtividade = revisao.variacaoAtividade;
    base.classificacaoAtividade = revisao.classificacaoAtividade;
    base.revisaoManual = revisao.revisaoManual;
  } catch (error) {
    base.motivo = error instanceof Error ? error.message : "Dados inválidos.";
  }
  return base;
}

export function aceitaFiltro(
  linha: LinhaQuadro,
  filtro: { q?: string; estado?: string },
): boolean {
  const q = (filtro.q ?? "").trim().toLocaleLowerCase("pt-PT");
  if (q && !linha.name.toLocaleLowerCase("pt-PT").includes(q)) return false;
  const estado = filtro.estado ?? "todos";
  if (estado === "incompleta") return linha.incompleta;
  if (estado === "manual") return linha.revisaoManual === true;
  if (estado === "aprovada" || estado === "rejeitada" || estado === "rascunho") return linha.approvalStatus === estado;
  return true;
}
