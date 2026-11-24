import assert from "node:assert/strict";
import { modeloLinhas } from "./example";
import {
  computeSummary,
  monthlyRunRate,
  ruTier,
  suggestMonthlyUpdate,
} from "./pricing";

const summary = computeSummary(modeloLinhas({ exampleValues: true, employees: 0 }), 0.23);

assert.equal(summary.subtotalCorrente, 1950);
assert.equal(summary.subtotalOpcional, 400);
assert.equal(summary.correnteByPeriod.mensal, 1800);
assert.equal(summary.correnteByPeriod.anual, 150);
assert.equal(summary.correnteByPeriod.trimestral, 0);
assert.equal(summary.correnteByPeriod.one_shot, 0);
assert.equal(summary.opcionalByPeriod.one_shot, 250);
assert.equal(summary.opcionalByPeriod.anual, 150);
assert.equal(summary.vatCorrente, 448.5);
assert.equal(summary.totalCorrenteComIva, 2398.5);
assert.equal(summary.totalComOpcionais, 2890.5);
assert.equal(summary.sobConsulta, 2);
assert.equal(monthlyRunRate(summary), 150);

const withStaff = computeSummary(modeloLinhas({ exampleValues: true, employees: 4 }), 0.23);
const payroll = withStaff.lines.find((line) => line.pricingRule === "payroll");
const ru = withStaff.lines.find((line) => line.pricingRule === "ru_tier");
assert.equal(payroll?.periodAmount, 40);
assert.equal(payroll?.annualAmount, 480);
assert.equal(ru?.periodAmount, 80);
assert.equal(ru?.tierLabel, "1 a 5");

assert.equal(ruTier(0), null);
assert.equal(ruTier(1)?.annual, 80);
assert.equal(ruTier(5)?.annual, 80);
assert.equal(ruTier(6)?.annual, 150);
assert.equal(ruTier(20)?.annual, 150);
assert.equal(ruTier(21)?.annual, 200);
assert.equal(ruTier(50)?.annual, 200);
assert.equal(ruTier(51)?.annual, 350);
assert.equal(ruTier(99)?.annual, 350);
assert.equal(ruTier(100)?.annual, 550);
assert.equal(ruTier(240)?.annual, 550);

assert.equal(suggestMonthlyUpdate(150, null).applied, 10);
assert.equal(suggestMonthlyUpdate(150, 0.05).applied, 10);
assert.equal(suggestMonthlyUpdate(150, 0.05).basis, "base");
assert.equal(suggestMonthlyUpdate(150, 0.08).applied, 12);
assert.equal(suggestMonthlyUpdate(150, 0.08).basis, "ipc");

const admissions = computeSummary([
  {
    description: "Admissões",
    periodicity: "one_shot",
    quantity: 3,
    inclusion: "valor",
    optional: false,
    unitValue: 12,
    manual: false,
    pricingRule: "per_occurrence",
  },
]);
assert.equal(admissions.lines[0]?.periodAmount, 36);
assert.equal(admissions.subtotalCorrente, 36);

console.log("Tabela de preços conferida.");
console.log(
  `Exemplo 2825 / 2027: correntes ${summary.subtotalCorrente} €, opcionais ${summary.subtotalOpcional} €, correntes com IVA ${summary.totalCorrenteComIva} €.`,
);
