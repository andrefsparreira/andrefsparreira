import textos from "@/data/textos-modelo.json";
import { eur, formatDatePT } from "./format";
import type { Client, ProposalSection } from "./types";

function cleanBullet(value: string): string {
  return value.replace(/^\s*[-•]\s*/, "").trim();
}

export function situacaoBullets(client: Client): string[] {
  const capital = client.capital == null ? "—" : eur(client.capital);
  const turnover = client.expectedTurnover == null ? "—" : eur(client.expectedTurnover);
  const accounts =
    client.bankAccounts == null
      ? "contas bancárias por indicar"
      : client.bankAccounts === 1
        ? "1 conta bancária"
        : `${client.bankAccounts} contas bancárias`;

  const bullets = [
    `O cliente é uma ${client.legalForm || "sociedade"} e tem por objeto social ${client.object || "—"}.`,
    `Atualmente tem ${client.partners || "sócios"} com um capital social de ${capital}.`,
  ];

  if ((client.employeesExManager ?? 0) <= 0) {
    bullets.push("Não tem processamento salarial.");
  } else {
    const n = client.employeesExManager;
    bullets.push(
      `Tem processamento salarial para ${n} colaborador${n === 1 ? "" : "es"}, excluindo o sócio-gerente.`,
    );
  }

  bullets.push(
    `Está inserida pelo regime ${client.ircRegime || "—"} de IRC e pelo regime ${client.ivaRegime || "—"} de IVA.`,
  );
  bullets.push(`Espera obter um volume de negócios anual de ${turnover} e movimenta ${accounts}.`);

  if (client.notes.trim()) {
    bullets.push(cleanBullet(client.notes));
  }
  return bullets;
}

export function buildProposalSections(client: Client, year: number): ProposalSection[] {
  const situacao = `Situação da empresa a ${formatDatePT(client.situationDate)}`;
  return [
    {
      id: "capa",
      kind: "cover",
      title: client.name,
      kicker: `Proposta de prestação de serviços ${year}`,
      tagline: textos.capa.tagline,
    },
    {
      id: "introducao",
      kind: "prose",
      title: textos.introducaoTitulo,
      body: textos.introducao.replaceAll("{{cliente}}", client.name),
    },
    {
      id: "situacao",
      kind: "bullets",
      title: situacao,
      intro: "",
      bullets: situacaoBullets(client),
    },
    {
      id: "fecho",
      kind: "columns",
      title: textos.fecho.titulo,
      subtitle: textos.fecho.subtitulo,
      columns: textos.fecho.colunas.map((column) => ({
        title: column.titulo,
        items: [...column.itens],
      })),
    },
    {
      id: "rh",
      kind: "columns",
      title: textos.rh.titulo,
      subtitle: textos.rh.subtitulo,
      columns: textos.rh.colunas.map((column) => ({
        title: column.titulo,
        items: [...column.itens],
      })),
    },
    {
      id: "limitacoes",
      kind: "bullets",
      title: textos.limitacoes.titulo,
      intro: textos.limitacoes.intro,
      bullets: textos.limitacoes.bullets.map(cleanBullet),
    },
    {
      id: "honorarios",
      kind: "honorarios",
      title: textos.honorarios.titulo,
      intro: textos.honorarios.intro,
    },
    {
      id: "ru",
      kind: "ru",
      title: textos.ru.titulo,
      intro:
        "Serviço opcional. O valor anual segue os escalões de colaboradores, excluindo o sócio-gerente. No modelo, a linha de honorários indica «desde 80,00 €», que corresponde ao escalão de 1 a 5.",
    },
    {
      id: "nota",
      kind: "note",
      title: textos.nota.titulo,
      bullets: textos.nota.bullets.map(cleanBullet),
    },
    {
      id: "condicoes",
      kind: "conditions",
      title: "Condições Contratuais",
      lead: textos.aceitacao,
      clauses: textos.clausulas.map((clause) => ({
        titulo: clause.titulo,
        corpo: clause.corpo.trim(),
      })),
    },
    {
      id: "assinatura",
      kind: "signature",
      title: "Aceitação",
      firm: textos.assinatura,
      note: textos.assinaturaNota,
    },
  ];
}
