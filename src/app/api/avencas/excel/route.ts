import { NextResponse } from "next/server";
import { excelAvencas } from "@/lib/avenca-excel";
import { aceitaFiltro } from "@/lib/avenca-quadro";
import { listQuadro } from "@/lib/queries";
import { requireIdentity, requireViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (!(await requireViewer())) return new NextResponse("Sessão em falta.", { status: 401 });
  const url = new URL(request.url);
  const pedido = Number(url.searchParams.get("ano") || 2027);
  const ano = Number.isInteger(pedido) && pedido >= 2000 && pedido <= 2100 ? pedido : 2027;
  const linhas = (await listQuadro(ano)).filter((linha) =>
    aceitaFiltro(linha, { q: url.searchParams.get("q") ?? "", estado: url.searchParams.get("estado") ?? "todos" }),
  );
  return new NextResponse(excelAvencas(linhas), {
    headers: {
      "content-type": "application/vnd.ms-excel; charset=utf-8",
      "content-disposition": `attachment; filename="avencas-${ano}.xls"`,
    },
  });
}
