import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { formatLongDate } from "@/lib/format";
import { computeSummary } from "@/lib/pricing";
import { getClient, getLines, getProposal, getVatRate, getYear } from "@/lib/queries";
import { ProposalDocument, publicFile } from "@/pdf/ProposalPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const proposal = getProposal(Number(id));
  if (!proposal) return new NextResponse("Proposta não encontrada", { status: 404 });
  const client = getClient(proposal.clientId);
  if (!client) return new NextResponse("Cliente não encontrado", { status: 404 });
  const year = getYear(client.id, proposal.year);
  const lines = year ? getLines(year.id) : [];
  const summary = computeSummary(lines, getVatRate());
  const logo = publicFile("/brand/ks-logo.png");
  if (!logo) return new NextResponse("Logótipo em falta", { status: 500 });
  const ru = summary.lines.find((line) => line.pricingRule === "ru_tier");

  const buffer = await renderToBuffer(
    <ProposalDocument
      clientName={client.name}
      year={proposal.year}
      dateLabel={formatLongDate(proposal.proposalDate)}
      sections={proposal.sections}
      summary={summary}
      logoSrc={logo}
      clientLogoSrc={publicFile(client.logoPath)}
      ruHeadcount={ru?.quantity ?? null}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proposta-${proposal.year}.pdf"`,
    },
  });
}
