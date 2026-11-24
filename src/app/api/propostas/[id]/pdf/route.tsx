import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { formatLongDate } from "@/lib/format";
import { computeSummary } from "@/lib/pricing";
import { getClient, getClientLogo, getLines, getProposal, getVatRate, getYear, retainerHistory } from "@/lib/queries";
import { ProposalDocument, publicFile } from "@/pdf/ProposalPdf";
import { requireIdentity, requireViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(_request);
  if (identity instanceof Response) return identity;
  if (!(await requireViewer())) return new NextResponse("Sessão em falta.", { status: 401 });
  const { id } = await context.params;
  const proposal = await getProposal(Number(id));
  if (!proposal) return new NextResponse("Proposta não encontrada", { status: 404 });
  const client = await getClient(proposal.clientId);
  if (!client) return new NextResponse("Cliente não encontrado", { status: 404 });
  const year = await getYear(client.id, proposal.year);
  const lines = year ? await getLines(year.id) : [];
  const summary = computeSummary(lines, await getVatRate());
  const logo = publicFile("/brand/ks-logo.png");
  if (!logo) return new NextResponse("Logótipo em falta", { status: 500 });
  const storedLogo = await getClientLogo(client.id);
  const ru = summary.lines.find((line) => line.pricingRule === "ru_tier");

  const buffer = await renderToBuffer(
    <ProposalDocument
      clientName={client.name}
      year={proposal.year}
      dateLabel={formatLongDate(proposal.proposalDate)}
      sections={proposal.sections}
      summary={summary}
      logoSrc={logo}
      clientLogoSrc={storedLogo ? `data:${storedLogo.mime};base64,${storedLogo.data}` : publicFile(client.logoPath)}
      ruHeadcount={ru?.quantity ?? null}
      history={await retainerHistory(client.id, proposal.year)}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proposta-${proposal.year}.pdf"`,
    },
  });
}
