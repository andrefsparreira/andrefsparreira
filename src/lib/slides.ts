import type { ProposalSection } from "./types";

/** Uma secção editável pode ocupar vários diapositivos, cada um com um único título. */
export function slidesOf(sections: ProposalSection[]): ProposalSection[] {
  return sections.flatMap((section) => {
    if (section.kind !== "conditions") return [section];
    const slides: ProposalSection[] = [];
    if (section.lead.trim()) {
      slides.push({
        id: `${section.id}-intro`,
        kind: "prose",
        title: section.title,
        body: section.lead,
        align: "justify",
      });
    }
    section.clauses.forEach((clause, index) => {
      slides.push({
        id: `${section.id}-${index}`,
        kind: "prose",
        title: clause.titulo,
        body: clause.corpo,
        align: "justify",
      });
    });
    return slides;
  });
}
