import { CONFIGURACAO_DEFAULT, type ConfiguracaoAvencas } from "./avenca-motor";

const CHAVES: (keyof Omit<ConfiguracaoAvencas, "avencasReferencia">)[] = [
  "inflacao",
  "tolerancia",
  "pesoOrganizacao",
  "pesoContabilizacao",
  "pesoFaturacao",
  "pesoDocumentos",
  "impactoCrescimento",
  "impactoComplexidade",
  "arredondamento",
  "avencaMaximaReferencia",
];

export function validarConfiguracao(input: ConfiguracaoAvencas): ConfiguracaoAvencas {
  const config = { ...input, avencasReferencia: [...input.avencasReferencia] };
  for (const chave of CHAVES) {
    const valor = config[chave];
    if (typeof valor !== "number" || !Number.isFinite(valor)) {
      throw new Error("Há um coeficiente que não é um número.");
    }
  }
  if (config.arredondamento <= 0) throw new Error("O arredondamento tem de ser positivo.");
  if (config.avencasReferencia.length !== 6 || config.avencasReferencia.some((valor) => !Number.isFinite(valor) || valor < 0)) {
    throw new Error("As avenças de referência são seis valores, de zero para cima.");
  }
  if (config.avencaMaximaReferencia < 0) throw new Error("A avença máxima de referência tem de ser zero ou positiva.");
  for (const chave of ["pesoOrganizacao", "pesoContabilizacao", "pesoFaturacao", "pesoDocumentos", "impactoCrescimento", "impactoComplexidade"] as const) {
    if (config[chave] < 0) throw new Error("Os pesos e os impactos são zero ou positivos.");
  }
  return config;
}

export function lerConfiguracao(raw: string | null | undefined): ConfiguracaoAvencas {
  if (!raw) return { ...CONFIGURACAO_DEFAULT, avencasReferencia: [...CONFIGURACAO_DEFAULT.avencasReferencia] };
  try {
    const parsed = JSON.parse(raw) as Partial<ConfiguracaoAvencas>;
    return validarConfiguracao({
      ...CONFIGURACAO_DEFAULT,
      ...parsed,
      avencasReferencia: Array.isArray(parsed.avencasReferencia)
        ? parsed.avencasReferencia.map((valor) => Number(valor))
        : [...CONFIGURACAO_DEFAULT.avencasReferencia],
    });
  } catch {
    return { ...CONFIGURACAO_DEFAULT, avencasReferencia: [...CONFIGURACAO_DEFAULT.avencasReferencia] };
  }
}
