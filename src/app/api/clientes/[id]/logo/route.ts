import { NextResponse } from "next/server";
import { getClientLogo } from "@/lib/queries";
import { requireViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireViewer())) return new NextResponse("Sessão em falta.", { status: 401 });
  const { id } = await context.params;
  const logo = await getClientLogo(Number(id));
  if (!logo) return new NextResponse("Sem fotografia.", { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(logo.data, "base64")), {
    headers: {
      "content-type": logo.mime,
      "cache-control": "private, no-store",
    },
  });
}
