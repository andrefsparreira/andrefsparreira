import type { LineDraft, ServiceType } from "./types";

export const EXAMPLE_CLIENT = {
  name: "2825 - Atividades Hoteleiras, Lda",
  nif: "",
  legalForm: "sociedade limitada",
  object: "as atividades de restaurantes tipo tradicional",
  ircRegime: "geral",
  ivaRegime: "trimestral",
  capital: 2,
  partners: "sócios",
  bankAccounts: 1,
  expectedTurnover: 40000,
  employeesExManager: 0,
  situationDate: "2026-05-01",
  notes:
    "Pretende um report trimestral personalizado, onde inclui um Balancete, uma Demontração de Resultados por Naturezas e um Balanço.",
  logoPath: "/brand/marca-cliente.png",
};

export const SERVICE_TYPES: Omit<ServiceType, "active">[] = [
  { code: "mensal", label: "Mensal", defaultPeriodicity: "mensal", pricingRule: "fixed", defaultInclusion: "valor", defaultOptional: false, defaultUnitValue: null, sortOrder: 10 },
  { code: "trimestral", label: "Trimestral", defaultPeriodicity: "trimestral", pricingRule: "fixed", defaultInclusion: "valor", defaultOptional: false, defaultUnitValue: null, sortOrder: 20 },
  { code: "anual", label: "Anual", defaultPeriodicity: "anual", pricingRule: "fixed", defaultInclusion: "valor", defaultOptional: false, defaultUnitValue: null, sortOrder: 30 },
  { code: "one_shot", label: "One Shot", defaultPeriodicity: "one_shot", pricingRule: "fixed", defaultInclusion: "valor", defaultOptional: false, defaultUnitValue: null, sortOrder: 40 },
  { code: "rh", label: "Recursos Humanos", defaultPeriodicity: "mensal", pricingRule: "payroll", defaultInclusion: "incluido", defaultOptional: false, defaultUnitValue: null, sortOrder: 50 },
  { code: "saft", label: "Faturação/SAFT", defaultPeriodicity: "mensal", pricingRule: "consultation", defaultInclusion: "sob_consulta", defaultOptional: true, defaultUnitValue: null, sortOrder: 60 },
  { code: "encerramento", label: "Encerramento de contas", defaultPeriodicity: "anual", pricingRule: "fixed", defaultInclusion: "valor", defaultOptional: false, defaultUnitValue: 150, sortOrder: 70 },
  { code: "reporting", label: "Reporting trimestral", defaultPeriodicity: "trimestral", pricingRule: "included", defaultInclusion: "incluido", defaultOptional: false, defaultUnitValue: null, sortOrder: 80 },
  { code: "ru", label: "Relatório Único", defaultPeriodicity: "anual", pricingRule: "ru_tier", defaultInclusion: "valor", defaultOptional: true, defaultUnitValue: null, sortOrder: 90 },
  { code: "admissoes", label: "Admissões/cessações SS", defaultPeriodicity: "one_shot", pricingRule: "per_occurrence", defaultInclusion: "valor", defaultOptional: false, defaultUnitValue: 12, sortOrder: 100 },
  { code: "rcbe", label: "RCBE", defaultPeriodicity: "one_shot", pricingRule: "fixed", defaultInclusion: "valor", defaultOptional: true, defaultUnitValue: 150, sortOrder: 110 },
  { code: "atas", label: "Livro de Atas", defaultPeriodicity: "one_shot", pricingRule: "fixed", defaultInclusion: "valor", defaultOptional: true, defaultUnitValue: 100, sortOrder: 120 },
  { code: "rel_gestao", label: "Relatório de Gestão", defaultPeriodicity: "anual", pricingRule: "fixed", defaultInclusion: "valor", defaultOptional: true, defaultUnitValue: 150, sortOrder: 130 },
  { code: "outros", label: "Outros", defaultPeriodicity: "one_shot", pricingRule: "consultation", defaultInclusion: "sob_consulta", defaultOptional: false, defaultUnitValue: null, sortOrder: 140 },
];

export function modeloLinhas(options: { exampleValues: boolean; employees: number }): LineDraft[] {
  const employees = options.employees;
  const avença = options.exampleValues ? 150 : null;
  return [
    { typeCode: "mensal", description: "Responsabilidade CC e execução dos serviços", periodicity: "mensal", quantity: null, inclusion: "valor", optional: false, unitValue: avença, manual: options.exampleValues, pricingRule: "fixed", notes: options.exampleValues ? "Valor do cliente no modelo (150,00 €/mês)." : "Preencher a avença mensal. No modelo de exemplo são 150,00 €." },
    { typeCode: "encerramento", description: "Avença de encerramento de contas anuais", periodicity: "anual", quantity: null, inclusion: "valor", optional: false, unitValue: 150, manual: false, pricingRule: "fixed", notes: "" },
    { typeCode: "reporting", description: "Reporting trimestral", periodicity: "trimestral", quantity: null, inclusion: "incluido", optional: false, unitValue: null, manual: false, pricingRule: "included", notes: "Balancete, demonstração de resultados e balanço, quando contratado." },
    { typeCode: "rh", description: "Processamento de vencimentos", periodicity: "mensal", quantity: employees, inclusion: "incluido", optional: false, unitValue: null, manual: false, pricingRule: "payroll", notes: "Quantidade = funcionários extra, sem o sócio-gerente." },
    { typeCode: "admissoes", description: "Admissões/cessações de colaboradores na Segurança Social", periodicity: "one_shot", quantity: 0, inclusion: "valor", optional: false, unitValue: 12, manual: false, pricingRule: "per_occurrence", notes: "Quantidade = número de ocorrências." },
    { typeCode: "ru", description: "Relatório Único (opcional)", periodicity: "anual", quantity: employees, inclusion: "valor", optional: true, unitValue: null, manual: false, pricingRule: "ru_tier", notes: "Quantidade = colaboradores, sem o sócio-gerente." },
    { typeCode: "saft", description: "Emissão de faturas e envio do ficheiro SAFT (opcional)", periodicity: "mensal", quantity: null, inclusion: "sob_consulta", optional: true, unitValue: null, manual: false, pricingRule: "consultation", notes: "" },
    { typeCode: "outros", description: "Outros serviços solicitados (se aplicado)", periodicity: "one_shot", quantity: null, inclusion: "sob_consulta", optional: false, unitValue: null, manual: false, pricingRule: "consultation", notes: "" },
    { typeCode: "rcbe", description: "Apoio no RCBE (opcional)", periodicity: "one_shot", quantity: null, inclusion: "valor", optional: true, unitValue: 150, manual: false, pricingRule: "fixed", notes: "" },
    { typeCode: "atas", description: "Livro de Atas (opcional)", periodicity: "one_shot", quantity: null, inclusion: "valor", optional: true, unitValue: 100, manual: false, pricingRule: "fixed", notes: "" },
    { typeCode: "rel_gestao", description: "Relatório de Gestão (opcional)", periodicity: "anual", quantity: null, inclusion: "valor", optional: true, unitValue: 150, manual: false, pricingRule: "fixed", notes: "" },
  ];
}
