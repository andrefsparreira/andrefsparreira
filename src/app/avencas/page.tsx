import Link from "next/link";
import { TabelaAvencas } from "@/components/TabelaAvencas";
import { listQuadro } from "@/lib/queries";
import { requireViewer } from "@/lib/viewer";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AvencasPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  if (!(await requireViewer())) return null;
  const sp = await searchParams;
  const pedido = Number(sp.ano || 2027);
  const ano = Number.isInteger(pedido) && pedido >= 2000 && pedido <= 2100 ? pedido : 2027;
  const anos = await sql<{ year: number }>("SELECT DISTINCT year FROM fee_years ORDER BY year");
  const linhas = await listQuadro(ano);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-[#8d2f39]">Geral</p>
        <h1 className="font-serif text-4xl text-navy">Avaliação de avenças</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Exercício {ano} face a {ano - 1}. A ordenação, o filtro e a exportação usam o mesmo cálculo da ficha.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(anos.length ? anos : [{ year: ano }]).map((item) => (
          <Link
            key={item.year}
            href={`/avencas?ano=${item.year}`}
            className={`rounded-full px-3 py-1 text-sm ${item.year === ano ? "bg-navy text-white" : "bg-white text-navy"}`}
          >
            {item.year}
          </Link>
        ))}
      </div>
      <TabelaAvencas key={`${ano}-${linhas.map((linha) => `${linha.clientId}:${linha.approvalStatus}:${linha.avencaArredondada ?? ""}`).join("|")}`} linhas={linhas} ano={ano} />
    </div>
  );
}
