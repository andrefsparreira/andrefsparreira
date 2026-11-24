"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProposal } from "@/app/actions";
import { CompositionChart, RuChart } from "@/components/Charts";
import { HonorariosTable } from "@/components/HonorariosTable";
import { formatLongDate } from "@/lib/format";
import { HistorySlide } from "@/components/RetainerHistory";
import type { Summary } from "@/lib/pricing";
import { slidesOf } from "@/lib/slides";
import type { ProposalSection, RetainerSnapshot } from "@/lib/types";

const input = "w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy";

export function ProposalEditor({
  proposalId,
  proposalDate,
  sections,
  summary,
  clientName,
  clientLogo,
  year,
  history,
  initialEditing,
}: {
  proposalId: number;
  proposalDate: string;
  sections: ProposalSection[];
  summary: Summary;
  clientName: string;
  clientLogo: string | null;
  year: number;
  history: RetainerSnapshot[];
  initialEditing: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(initialEditing);
  const [date, setDate] = useState(proposalDate);
  const [draft, setDraft] = useState(sections);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const ru = summary.lines.find((line) => line.pricingRule === "ru_tier");

  function update(index: number, section: ProposalSection) {
    setDraft((current) => current.map((item, itemIndex) => (itemIndex === index ? section : item)));
  }

  function save() {
    setMessage("");
    const sections = draft.map((section) => {
      if (section.kind === "bullets" || section.kind === "note") {
        return { ...section, bullets: section.bullets.map((bullet) => bullet.trim()).filter(Boolean) };
      }
      if (section.kind === "columns") {
        return {
          ...section,
          columns: section.columns.map((column) => ({
            ...column,
            items: column.items.map((item) => item.trim()).filter(Boolean),
          })),
        };
      }
      return section;
    });
    startTransition(async () => {
      const result = await saveProposal({ id: proposalId, proposalDate: date, sections });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("Textos guardados.");
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="rounded-md border border-navy bg-white px-4 py-2 text-sm font-medium text-navy"
        >
          {editing ? "Fechar edição" : "Editar textos"}
        </button>
        <a
          href={`/api/propostas/${proposalId}/pdf`}
          className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white"
        >
          Gerar PDF
        </a>
        <a href={`/api/propostas/${proposalId}/pdf`} className="rounded-md px-4 py-2 text-sm text-navy">
          Imprimir
        </a>
        {editing ? (
          <button type="button" onClick={save} disabled={pending} className="rounded-md bg-[#8d2f39] px-4 py-2 text-sm text-white">
            {pending ? "A guardar…" : "Guardar textos"}
          </button>
        ) : null}
        {message ? <span className="text-sm text-navy">{message}</span> : null}
      </div>

      {editing ? (
        <div className="no-print mb-8 rounded-xl border border-line bg-card p-4">
          <label className="block max-w-xs text-sm">
            Data da proposta
            <input type="date" className={`${input} mt-1`} value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="mt-4 space-y-6">
            {draft.map((section, index) => (
              <section key={section.id} className="border-t border-line pt-4">
                <h3 className="mb-2 text-sm font-medium text-navy">{section.title || section.kind}</h3>
                <SectionFields section={section} onChange={(next) => update(index, next)} />
              </section>
            ))}
          </div>
        </div>
      ) : null}

      <div className="slide-deck">
        {slidesOf(draft).map((section) => (
          <div key={section.id} className="contents">
            {section.kind === "honorarios" ? (
              <article className="print-sheet overflow-hidden rounded-xl bg-white shadow-sheet">
                <HistorySlide rows={history} proposalYear={year} />
                <span className="page-no" />
              </article>
            ) : null}
            <article className={`print-sheet overflow-hidden rounded-xl bg-white shadow-sheet ${section.kind === "cover" ? "print-cover" : ""}`}>
              <SectionView
                section={section}
                summary={summary}
                clientName={clientName}
                clientLogo={clientLogo}
                year={year}
                dateLabel={formatLongDate(date)}
                ruHeadcount={ru?.quantity ?? null}
              />
              {section.kind === "cover" ? null : <span className="page-no" />}
            </article>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionFields({
  section,
  onChange,
}: {
  section: ProposalSection;
  onChange: (section: ProposalSection) => void;
}) {
  if (section.kind === "cover") {
    return (
      <div className="space-y-2">
        <input className={input} value={section.kicker} onChange={(event) => onChange({ ...section, kicker: event.target.value })} />
        <input className={input} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
        <textarea className={input} rows={4} value={section.tagline} onChange={(event) => onChange({ ...section, tagline: event.target.value })} />
      </div>
    );
  }
  if (section.kind === "prose") {
    return (
      <div className="space-y-2">
        <input className={input} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
        <textarea className={input} rows={6} value={section.body} onChange={(event) => onChange({ ...section, body: event.target.value })} />
      </div>
    );
  }
  if (section.kind === "bullets" || section.kind === "note") {
    return (
      <div className="space-y-2">
        <input className={input} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
        {section.kind === "bullets" ? (
          <textarea className={input} rows={2} value={section.intro} onChange={(event) => onChange({ ...section, intro: event.target.value })} />
        ) : null}
        <textarea
          className={input}
          rows={6}
          value={section.bullets.join("\n")}
          onChange={(event) => onChange({ ...section, bullets: event.target.value.split("\n") })}
        />
      </div>
    );
  }
  if (section.kind === "columns") {
    return (
      <div className="space-y-3">
        <input className={input} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
        <input className={input} value={section.subtitle} onChange={(event) => onChange({ ...section, subtitle: event.target.value })} />
        {section.columns.map((column, columnIndex) => (
          <div key={column.title + columnIndex}>
            <input
              className={`${input} mb-1`}
              value={column.title}
              onChange={(event) => {
                const columns = section.columns.map((item, itemIndex) =>
                  itemIndex === columnIndex ? { ...item, title: event.target.value } : item,
                );
                onChange({ ...section, columns });
              }}
            />
            <textarea
              className={input}
              rows={5}
              value={column.items.join("\n")}
              onChange={(event) => {
                const columns = section.columns.map((item, itemIndex) =>
                  itemIndex === columnIndex ? { ...item, items: event.target.value.split("\n") } : item,
                );
                onChange({ ...section, columns });
              }}
            />
          </div>
        ))}
      </div>
    );
  }
  if (section.kind === "honorarios" || section.kind === "ru") {
    return (
      <div className="space-y-2">
        <input className={input} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
        <textarea className={input} rows={3} value={section.intro} onChange={(event) => onChange({ ...section, intro: event.target.value })} />
        <p className="text-xs text-muted">A tabela numérica vem das linhas de avença guardadas e não se edita aqui.</p>
      </div>
    );
  }
  if (section.kind === "conditions") {
    return (
      <div className="space-y-3">
        <input className={input} value={section.title} onChange={(event) => onChange({ ...section, title: event.target.value })} />
        <textarea className={input} rows={3} value={section.lead} onChange={(event) => onChange({ ...section, lead: event.target.value })} />
        {section.clauses.map((clause, clauseIndex) => (
          <div key={clause.titulo + clauseIndex} className="space-y-1">
            <input
              className={input}
              value={clause.titulo}
              onChange={(event) => {
                const clauses = section.clauses.map((item, itemIndex) =>
                  itemIndex === clauseIndex ? { ...item, titulo: event.target.value } : item,
                );
                onChange({ ...section, clauses });
              }}
            />
            <textarea
              className={input}
              rows={5}
              value={clause.corpo}
              onChange={(event) => {
                const clauses = section.clauses.map((item, itemIndex) =>
                  itemIndex === clauseIndex ? { ...item, corpo: event.target.value } : item,
                );
                onChange({ ...section, clauses });
              }}
            />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <input className={input} value={section.firm} onChange={(event) => onChange({ ...section, firm: event.target.value })} />
      <input className={input} value={section.note} onChange={(event) => onChange({ ...section, note: event.target.value })} />
    </div>
  );
}

function SectionView({
  section,
  summary,
  clientName,
  clientLogo,
  year,
  dateLabel,
  ruHeadcount,
}: {
  section: ProposalSection;
  summary: Summary;
  clientName: string;
  clientLogo: string | null;
  year: number;
  dateLabel: string;
  ruHeadcount: number | null;
}) {
  if (section.kind === "cover") {
    return (
      <div className="flex h-full min-h-[28rem] flex-col p-8 md:p-10">
        <img src="/brand/ks-logo.png" alt="KS Consultores" className="h-10 w-auto self-start" />
        <div className="mt-8 flex flex-1 items-center gap-8">
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.18em] text-[#8d2f39]">{section.kicker}</p>
            <h1 className="mt-4 font-serif text-4xl leading-tight text-navy">{section.title}</h1>
            <p className="mt-6 max-w-xl whitespace-pre-line text-lg text-ink">{section.tagline}</p>
          </div>
          <div className="flex h-full min-h-56 flex-1 items-center justify-center rounded-xl bg-navy-soft p-6">
            {clientLogo ? (
              <img src={clientLogo} alt="" className="max-h-56 w-auto" />
            ) : (
              <p className="font-serif text-3xl text-navy">{year}</p>
            )}
          </div>
        </div>
        <p className="mt-6 text-sm text-muted">{dateLabel}</p>
      </div>
    );
  }

  return (
    <div className="relative p-8 md:p-10">
      <img src="/brand/ks-logo.png" alt="" className="ml-auto h-7 w-auto" />
      <h2 className="mt-6 font-serif text-3xl text-navy">{section.title}</h2>
      {section.kind === "prose" ? (
        <p className={`mt-6 whitespace-pre-line text-[17px] leading-8 ${section.align === "justify" ? "text-justify text-sm leading-6" : ""}`}>{section.body}</p>
      ) : null}
      {section.kind === "bullets" || section.kind === "note" ? (
        <div className="mt-6">
          {section.kind === "bullets" && section.intro ? <p className="mb-4 text-[17px]">{section.intro}</p> : null}
          <ul className="space-y-3 text-[17px] leading-7">
            {section.bullets.map((bullet) => (
              <li key={bullet} className="border-l-2 border-navy/30 pl-4">{bullet}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {section.kind === "columns" ? (
        <div>
          <p className="mt-2 text-sm uppercase tracking-wide text-muted">{section.subtitle}</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {section.columns.map((column) => (
              <div key={column.title} className="rounded-xl border border-line bg-paper/50 p-4">
                <h3 className="font-medium text-navy">{column.title}</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  {column.items.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {section.kind === "honorarios" ? (
        <div className="mt-6 space-y-6">
          <p>{section.intro}</p>
          <HonorariosTable summary={summary} />
          <CompositionChart summary={summary} />
        </div>
      ) : null}
      {section.kind === "ru" ? (
        <div className="mt-6 space-y-6">
          <p>{section.intro}</p>
          <RuChart headcount={ruHeadcount} />
        </div>
      ) : null}
      {section.kind === "conditions" ? (
        <div className="mt-6 space-y-5 text-sm leading-6">
          <p className="text-base">{section.lead}</p>
          {section.clauses.map((clause) => (
            <section key={clause.titulo}>
              <h3 className="font-serif text-lg text-navy">{clause.titulo}</h3>
              <p className="mt-2 whitespace-pre-line text-justify">{clause.corpo}</p>
            </section>
          ))}
        </div>
      ) : null}
      {section.kind === "signature" ? (
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="min-h-36 rounded-xl border border-dashed border-line p-6 text-center">
            <p className="font-medium text-navy">{section.firm}</p>
            <p className="mt-16 text-sm text-muted">{section.note}</p>
          </div>
          <div className="min-h-36 rounded-xl border border-dashed border-line p-6 text-center">
            <p className="font-medium text-navy">O Cliente</p>
            <p className="mt-16 text-sm text-muted">aceitação e assinatura</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
