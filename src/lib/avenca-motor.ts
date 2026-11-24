export const NIVEIS_ORGANIZACAO = [
  { value: 1, label: "Muito organizado", color: "#16a34a" },
  { value: 2, label: "Organizado", color: "#65a30d" },
  { value: 3, label: "Razoavelmente organizado", color: "#a3a30a" },
  { value: 4, label: "Pouco organizado", color: "#eab308" },
  { value: 5, label: "Desorganizado", color: "#f97316" },
  { value: 6, label: "Muito desorganizado", color: "#dc2626" },
];

export const NIVEIS_CONTABILIZACAO = [
  { value: 1, label: "Muito fácil" },
  { value: 2, label: "Fácil" },
  { value: 3, label: "Pouco difícil" },
  { value: 4, label: "Moderadamente difícil" },
  { value: 5, label: "Difícil" },
  { value: 6, label: "Muito difícil" },
];

export const NIVEIS_RATING = [
  { value: 1, label: "Muito simples" },
  { value: 2, label: "Simples" },
  { value: 3, label: "Regular" },
  { value: 4, label: "Moderado" },
  { value: 5, label: "Complexo" },
  { value: 6, label: "Muito complexo" },
];

export interface DadosAnuais {
  faturacao: number;
  documentos: number;
  organizacao: number;
  contabilizacao: number;
}

export interface ConfiguracaoAvencas {
  inflacao: number;
  tolerancia: number;
  pesoOrganizacao: number;
  pesoContabilizacao: number;
  pesoFaturacao: number;
  pesoDocumentos: number;
  impactoCrescimento: number;
  impactoComplexidade: number;
  arredondamento: number;
  avencasReferencia: number[];
  avencaMaximaReferencia: number;
}

export const CONFIGURACAO_DEFAULT: ConfiguracaoAvencas = {
  inflacao: 2.5,
  tolerancia: 5,

  pesoOrganizacao: 0.4,
  pesoContabilizacao: 0.6,

  pesoFaturacao: 0.4,
  pesoDocumentos: 0.6,

  impactoCrescimento: 0.4,
  impactoComplexidade: 0.6,

  arredondamento: 5,

  avencasReferencia: [100, 150, 225, 325, 450, 600],
  avencaMaximaReferencia: 600,
};

const round = (value: number) => Math.round(value * 100) / 100;

function validarDados(dados: DadosAnuais) {
  if (
    !Number.isInteger(dados.organizacao) ||
    dados.organizacao < 1 ||
    dados.organizacao > 6 ||
    !Number.isInteger(dados.contabilizacao) ||
    dados.contabilizacao < 1 ||
    dados.contabilizacao > 6
  ) {
    throw new Error("Os níveis devem estar entre 1 e 6.");
  }

  if (
    !Number.isFinite(dados.faturacao) ||
    !Number.isInteger(dados.documentos) ||
    dados.faturacao < 0 ||
    dados.documentos < 0
  ) {
    throw new Error("Valores de atividade inválidos.");
  }
}

// C - Rating contabilístico
export function calcularRating(dados: DadosAnuais, config = CONFIGURACAO_DEFAULT) {
  validarDados(dados);

  return dados.organizacao * config.pesoOrganizacao + dados.contabilizacao * config.pesoContabilizacao;
}

// D - Conversão do rating em percentagem
export function calcularComplexidade(rating: number) {
  return rating / 6;
}

// E - Avença teórica
export function calcularAvencaTeorica(dados: DadosAnuais, config = CONFIGURACAO_DEFAULT) {
  const rating = calcularRating(dados, config);
  const complexidade = calcularComplexidade(rating);

  const inferior = Math.floor(rating) - 1;
  const superior = Math.min(inferior + 1, 5);

  const valorInferior = config.avencasReferencia[inferior];

  const valorSuperior = config.avencasReferencia[superior];

  // Interpolação entre os níveis de avença
  const valorBase = valorInferior + (valorSuperior - valorInferior) * (rating - Math.floor(rating));

  const valorProporcional = complexidade * config.avencaMaximaReferencia;

  const avenca = valorBase * 0.6 + valorProporcional * 0.4;

  return {
    rating: round(rating),
    rating10: round(complexidade * 10),
    classificacao: NIVEIS_RATING[Math.round(rating) - 1].label,
    complexidadePercentual: round(complexidade * 100),
    valorBase: round(valorBase),
    valorProporcional: round(valorProporcional),
    avencaTeorica: round(avenca),
  };
}

// Variação percentual entre dois exercícios
export function calcularVariacao(anterior: number, atual: number): number | null {
  if (anterior === 0) {
    return atual === 0 ? 0 : null;
  }

  return ((atual - anterior) / anterior) * 100;
}

// Revisão anual de avenças
export function calcularRevisaoAvenca(
  avencaAnterior: number,
  anterior: DadosAnuais,
  atual: DadosAnuais,
  config = CONFIGURACAO_DEFAULT,
) {
  validarDados(anterior);
  validarDados(atual);

  if (!Number.isFinite(avencaAnterior) || avencaAnterior <= 0) {
    throw new Error("A avença anterior deve ser positiva.");
  }

  const ratingAnterior = calcularRating(anterior, config);
  const ratingAtual = calcularRating(atual, config);

  const variacaoFaturacao = calcularVariacao(anterior.faturacao, atual.faturacao);

  const variacaoDocumentos = calcularVariacao(anterior.documentos, atual.documentos);

  // Não calcular crescimento percentual sobre uma base nula
  if (variacaoFaturacao === null || variacaoDocumentos === null) {
    return {
      revisaoManual: true,
      avencaProposta: null,
      motivo: "Não existe uma base comparável no ano anterior.",
    };
  }

  const variacaoAtividade =
    variacaoFaturacao * config.pesoFaturacao + variacaoDocumentos * config.pesoDocumentos;

  const variacaoComplexidade = ((ratingAtual - ratingAnterior) / ratingAnterior) * 100;

  // Ajuste apenas acima da margem de tolerância
  const ajusteAtividade = Math.max(0, variacaoAtividade - config.tolerancia) * config.impactoCrescimento;

  // Não reduzir automaticamente a avença
  const ajusteComplexidade = Math.max(0, variacaoComplexidade) * config.impactoComplexidade;

  const atualizacaoTotal = config.inflacao + ajusteAtividade + ajusteComplexidade;

  const avencaProposta = avencaAnterior * (1 + atualizacaoTotal / 100);

  const avencaArredondada = Math.round(avencaProposta / config.arredondamento) * config.arredondamento;

  const avencaTeorica = calcularAvencaTeorica(atual, config).avencaTeorica;

  let classificacaoAtividade = "";

  if (variacaoAtividade < -30) {
    classificacaoAtividade = "Redução significativa";
  } else if (variacaoAtividade < -15) {
    classificacaoAtividade = "Redução moderada";
  } else if (variacaoAtividade < -config.tolerancia) {
    classificacaoAtividade = "Ligeira redução";
  } else if (variacaoAtividade <= config.tolerancia) {
    classificacaoAtividade = "Estável";
  } else if (variacaoAtividade <= 15) {
    classificacaoAtividade = "Ligeiro crescimento";
  } else if (variacaoAtividade <= 30) {
    classificacaoAtividade = "Crescimento moderado";
  } else {
    classificacaoAtividade = "Crescimento significativo";
  }

  const apenasInflacao =
    Math.abs(variacaoAtividade) <= config.tolerancia && Math.abs(ratingAtual - ratingAnterior) < 0.000001;

  const revisaoManual =
    variacaoAtividade < -15 || variacaoAtividade > 30 || variacaoComplexidade < 0 || Math.abs(variacaoDocumentos) > 30;

  return {
    ratingAnterior: round(ratingAnterior),
    ratingAtual: round(ratingAtual),

    variacaoFaturacao: round(variacaoFaturacao),
    variacaoDocumentos: round(variacaoDocumentos),
    variacaoAtividade: round(variacaoAtividade),
    variacaoComplexidade: round(variacaoComplexidade),

    classificacaoAtividade,

    inflacao: config.inflacao,
    ajusteAtividade: round(ajusteAtividade),
    ajusteComplexidade: round(ajusteComplexidade),
    atualizacaoTotal: round(atualizacaoTotal),

    avencaAnterior: round(avencaAnterior),
    avencaTeorica: round(avencaTeorica),
    avencaProposta: round(avencaProposta),
    avencaArredondada: round(avencaArredondada),

    aumentoMensal: round(avencaProposta - avencaAnterior),
    aumentoAnual: round((avencaProposta - avencaAnterior) * 12),

    diferencaAvencaTeorica: round(avencaTeorica - avencaProposta),

    apenasInflacao,
    revisaoManual,
  };
}
