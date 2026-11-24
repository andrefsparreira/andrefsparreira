import assert from "node:assert/strict";
import { lerConfiguracao, validarConfiguracao } from "./avenca-config";
import { excelAvencas } from "./avenca-excel";
import {
  CONFIGURACAO_DEFAULT,
  calcularAvencaTeorica,
  calcularComplexidade,
  calcularRating,
  calcularRevisaoAvenca,
  calcularVariacao,
} from "./avenca-motor";
import { aceitaFiltro, montarLinha, type LinhaQuadro } from "./avenca-quadro";

const simples = { faturacao: 40_000, documentos: 30, organizacao: 1, contabilizacao: 1 };
assert.equal(calcularRating(simples), 1);
assert.equal(calcularComplexidade(1), 1 / 6);
const minima = calcularAvencaTeorica(simples);
assert.equal(minima.rating, 1);
assert.equal(minima.classificacao, "Muito simples");
assert.equal(minima.valorBase, 100);
assert.equal(minima.avencaTeorica, 100);

const maxima = calcularAvencaTeorica({ faturacao: 1, documentos: 1, organizacao: 6, contabilizacao: 6 });
assert.equal(maxima.rating, 6);
assert.equal(maxima.classificacao, "Muito complexo");
assert.equal(maxima.avencaTeorica, 600);

const atual = { faturacao: 80_000, documentos: 40, organizacao: 2, contabilizacao: 3 };
const teorica = calcularAvencaTeorica(atual);
assert.equal(teorica.rating, 2.6);
assert.equal(teorica.rating10, 4.33);
assert.equal(teorica.classificacao, "Regular");
assert.equal(teorica.complexidadePercentual, 43.33);
assert.equal(teorica.valorBase, 195);
assert.equal(teorica.valorProporcional, 260);
assert.equal(teorica.avencaTeorica, 221);

assert.equal(calcularVariacao(0, 0), 0);
assert.equal(calcularVariacao(0, 10), null);
assert.equal(calcularVariacao(100, 110), 10);

const anterior = { faturacao: 70_000, documentos: 30, organizacao: 2, contabilizacao: 3 };
const revisao = calcularRevisaoAvenca(200, anterior, atual);
assert.equal(revisao.variacaoFaturacao, 14.29);
assert.equal(revisao.variacaoDocumentos, 33.33);
assert.equal(revisao.variacaoAtividade, 25.71);
assert.equal(revisao.classificacaoAtividade, "Crescimento moderado");
assert.equal(revisao.ajusteAtividade, 8.29);
assert.equal(revisao.ajusteComplexidade, 0);
assert.equal(revisao.atualizacaoTotal, 10.79);
assert.equal(revisao.avencaProposta, 221.57);
assert.equal(revisao.avencaArredondada, 220);
assert.equal(revisao.aumentoMensal, 21.57);
assert.equal(revisao.aumentoAnual, 258.86);
assert.equal(revisao.revisaoManual, true);
assert.equal(revisao.apenasInflacao, false);

const estavel = { faturacao: 40_000, documentos: 30, organizacao: 2, contabilizacao: 2 };
const inflacao = calcularRevisaoAvenca(150, estavel, estavel);
assert.equal(inflacao.avencaProposta, 153.75);
assert.equal(inflacao.avencaArredondada, 155);
assert.equal(inflacao.classificacaoAtividade, "Estável");
assert.equal(inflacao.apenasInflacao, true);
assert.equal(inflacao.revisaoManual, false);
assert.equal(inflacao.ajusteComplexidade, 0);

const maisSimples = calcularRevisaoAvenca(
  150,
  { faturacao: 40_000, documentos: 30, organizacao: 4, contabilizacao: 4 },
  { faturacao: 40_000, documentos: 30, organizacao: 2, contabilizacao: 2 },
);
assert.equal(maisSimples.ajusteComplexidade, 0);
assert.ok(maisSimples.variacaoComplexidade < 0);
assert.equal(maisSimples.revisaoManual, true);

const semBase = calcularRevisaoAvenca(
  150,
  { faturacao: 0, documentos: 0, organizacao: 2, contabilizacao: 2 },
  { faturacao: 10, documentos: 1, organizacao: 2, contabilizacao: 2 },
);
assert.equal(semBase.avencaProposta, null);
assert.equal(semBase.revisaoManual, true);
assert.equal(semBase.motivo, "Não existe uma base comparável no ano anterior.");

assert.throws(() => calcularRating({ faturacao: 1, documentos: 1, organizacao: 0, contabilizacao: 1 }), /1 e 6/);
assert.throws(() => calcularRating({ faturacao: 1, documentos: 1.5, organizacao: 1, contabilizacao: 1 }), /atividade/);
assert.throws(() => calcularRating({ faturacao: -1, documentos: 1, organizacao: 1, contabilizacao: 1 }), /atividade/);
assert.throws(() => calcularRevisaoAvenca(0, estavel, estavel), /positiva/);

const arredondada = calcularRevisaoAvenca(150, estavel, estavel, { ...CONFIGURACAO_DEFAULT, arredondamento: 10 });
assert.equal(arredondada.avencaArredondada, 150);

assert.throws(() => validarConfiguracao({ ...CONFIGURACAO_DEFAULT, arredondamento: 0 }), /arredondamento/);
assert.deepEqual(lerConfiguracao("não é json").avencasReferencia, CONFIGURACAO_DEFAULT.avencasReferencia);
assert.equal(lerConfiguracao(JSON.stringify({ inflacao: 3 })).inflacao, 3);

const linha = montarLinha({
  clientId: 1,
  name: "Hotel & Mar",
  year: 2027,
  atual: { ...estavel, approvalStatus: "rascunho", approvedRetainer: null },
  anterior: estavel,
  avencaAnterior: 150,
  config: CONFIGURACAO_DEFAULT,
});
assert.equal(linha.avencaArredondada, 155);
assert.equal(linha.incompleta, false);
assert.equal(aceitaFiltro(linha, { q: "hotel" }), true);
assert.equal(aceitaFiltro(linha, { q: "padaria" }), false);
assert.equal(aceitaFiltro(linha, { estado: "aprovada" }), false);
assert.equal(aceitaFiltro(linha, { estado: "rascunho" }), true);

const incompleta = montarLinha({
  clientId: 2,
  name: "Sem dados",
  year: 2027,
  atual: null,
  anterior: null,
  avencaAnterior: null,
  config: CONFIGURACAO_DEFAULT,
});
assert.equal(incompleta.incompleta, true);
assert.equal(aceitaFiltro(incompleta, { estado: "incompleta" }), true);

const livro = excelAvencas([linha satisfies LinhaQuadro]);
assert.match(livro, /Hotel &amp; Mar/);
assert.match(livro, /ss:Type="Number">155</);
assert.match(livro, /<Worksheet ss:Name="Avenças">/);

console.log("avenca-motor.check: ok");
