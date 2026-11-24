import Link from "next/link";
import { notFound } from "next/navigation";
import { resetProposalTexts } from "@/app/actions";
import { ProposalEditor } from "@/components/ProposalEditor";
import { computeSummary } from "@/lib/pricing";
import { getClient, getLines, getProposal, getVatRate, getYear, retainerHistory } from "@/lib/queries";
import { requireViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function ProposalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string; ok?: string; erro?: string }>;
}) {
  if (!(await requireViewer())) return null;
  const { id } = await params;
  const sp = await searchParams;
  const proposal = await getProposal(Number(id));
  if (!proposal) notFound();
  const client = await getClient(proposal.clientId);
  if (!client) notFound();
  const year = await getYear(client.id, proposal.year);
  const lines = year ? await getLines(year.id) : [];
  const summary = computeSummary(lines, await getVatRate());
  const history = await retainerHistory(client.id, proposal.year);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/clientes/${client.id}?ano=${proposal.year}`} className="text-sm text-navy hover:underline">
            Voltar à ficha
          </Link>
          <h1 className="font-serif text-3xl text-navy">{proposal.title}</h1>
        </div>
        <form action={resetProposalTexts}>
          <input type="hidden" name="id" value={proposal.id} />
          <button className="text-sm text-muted underline">Repor textos do modelo</button>
        </form>
      </div>
      {sp.ok === "textos" ? <p className="no-print mb-4 text-sm text-navy">Textos repostos a partir do modelo.</p> : null}
      {sp.ok === "foto" ? <p className="no-print mb-4 text-sm text-navy">Fotografia da capa guardada.</p> : null}
      {sp.erro === "foto" ? <p className="no-print mb-4 text-sm text-[#8d2f39]">A fotografia tem de ser JPEG ou PNG, até 4 MB.</p> : null}
      <ProposalEditor
        key={`${proposal.id}-${proposal.updatedAt}`}
        proposalId={proposal.id}
        proposalDate={proposal.proposalDate}
        sections={proposal.sections}
        summary={summary}
        clientName={client.name}
        clientId={client.id}
        clientLogo={client.logoPath}
        year={proposal.year}
        history={history}
        initialEditing={sp.editar === "1"}
      />
    </div>
  );
}
