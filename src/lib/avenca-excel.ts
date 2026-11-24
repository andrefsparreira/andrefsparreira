import type { LinhaQuadro } from "./avenca-quadro";

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(value: string | number | null): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }
  return `<Cell><Data ss:Type="String">${xml(value == null ? "" : String(value))}</Data></Cell>`;
}

const COLUMNS = [
  "Cliente",
  "Exercício",
  "Faturação N-1",
  "Faturação N",
  "Documentos N-1",
  "Documentos N",
  "Rating",
  "Classificação",
  "Avença anterior",
  "Avença teórica",
  "Avença proposta",
  "Avença arredondada",
  "Variação da atividade (%)",
  "Atividade",
  "Revisão manual",
  "Aprovação",
  "Avença aprovada",
  "Nota",
] as const;

export function excelAvencas(linhas: LinhaQuadro[]): string {
  const header = `<Row>${COLUMNS.map((column) => cell(column)).join("")}</Row>`;
  const body = linhas
    .map((linha) => {
      const values: (string | number | null)[] = [
        linha.name,
        linha.year,
        linha.faturacaoAnterior,
        linha.faturacao,
        linha.documentosAnterior,
        linha.documentos,
        linha.rating,
        linha.classificacao,
        linha.avencaAnterior,
        linha.avencaTeorica,
        linha.avencaProposta,
        linha.avencaArredondada,
        linha.variacaoAtividade,
        linha.classificacaoAtividade,
        linha.revisaoManual == null ? "" : linha.revisaoManual ? "Sim" : "Não",
        linha.approvalStatus,
        linha.approvedRetainer,
        linha.motivo,
      ];
      return `<Row>${values.map((value) => cell(value)).join("")}</Row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Avenças">
<Table>
${header}
${body}
</Table>
</Worksheet>
</Workbook>`;
}
