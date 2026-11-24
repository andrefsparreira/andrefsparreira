import { existsSync, readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { formatLongDate } from "@/lib/format";
import { computeSummary } from "@/lib/pricing";
import { getClient, getClientLogo, getLines, getProposal, getRuTiers, getVatRate, getYear, retainerHistory } from "@/lib/queries";
import { ProposalDocument, publicFile } from "@/pdf/ProposalPdf";
import { requireIdentity, requireViewer } from "@/lib/viewer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fileDataUri(file: string | null): string | null {
  if (!file || !existsSync(file)) return null;
  const kind = file.toLowerCase().endsWith(".png") ? "png" : "jpeg";
  return `data:image/${kind};base64,${readFileSync(file).toString("base64")}`;
}

function storedDataUri(mime: string, data: string): string | null {
  if (mime !== "image/png" && mime !== "image/jpeg") return null;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) return null;
  return `data:${mime};base64,${data.replace(/\s/g, "")}`;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await requireIdentity(_request);
  if (identity instanceof Response && !(await requireViewer())) return identity;
  if (!(await requireViewer())) return new NextResponse("Sessão em falta.", { status: 401 });
  const { id } = await context.params;
  const proposal = await getProposal(Number(id));
  if (!proposal) return new NextResponse("Proposta não encontrada", { status: 404 });
  const client = await getClient(proposal.clientId);
  if (!client) return new NextResponse("Cliente não encontrado", { status: 404 });
  const year = await getYear(client.id, proposal.year);
  const lines = year ? await getLines(year.id) : [];
  const tiers = await getRuTiers();
  const summary = computeSummary(lines, await getVatRate(), tiers);
  const logo = fileDataUri(publicFile("/brand/ks-logo.png"));
  const storedLogo = await getClientLogo(client.id);
  const clientLogo = storedLogo ? storedDataUri(storedLogo.mime, storedLogo.data) : fileDataUri(publicFile(client.logoPath));
  const ru = summary.lines.find((line) => line.pricingRule === "ru_tier");
  const history = await retainerHistory(client.id, proposal.year);

  const render = (clientLogoSrc: string | null) =>
    renderToBuffer(
      <ProposalDocument
        clientName={client.name}
        year={proposal.year}
        dateLabel={formatLongDate(proposal.proposalDate)}
        sections={proposal.sections}
        summary={summary}
        logoSrc={logo}
        clientLogoSrc={clientLogoSrc}
        ruHeadcount={ru?.quantity ?? null}
        history={history}
        ruTiers={tiers}
      />,
    );

  let buffer: Buffer;
  try {
    buffer = await render(clientLogo);
  } catch {
    try {
      buffer = await render(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao gerar o PDF.";
      return new NextResponse(message, { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="proposta-${proposal.year}.pdf"`,
    },
  });
}
