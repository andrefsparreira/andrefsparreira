import Link from "next/link";
import { eur } from "@/lib/format";
import { computeSummary } from "@/lib/pricing";
import { getLines, getVatRate, getYear, listClients } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const clients = await listClients(q);
  const vat = await getVatRate();
  const rows = await Promise.all(
    clients.map(async (client) => {
      const year = await getYear(client.id, 2027);
      const summary = computeSummary(year ? await getLines(year.id) : [], vat);
      return { client, year, summary };
    }),
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.16em] text-[#8d2f39]">Gabinete</p>
          <h1 className="font-serif text-4xl text-navy">Clientes e avenças</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Propostas de prestação de serviços para 2027, com o histórico de avenças e a tabela de honorários do modelo.
          </p>
        </div>
        <Link href="/clientes/novo" className="rounded-md bg-navy px-4 py-2 text-sm text-white">
          Novo cliente
        </Link>
      </div>

      <form className="mb-4" action="/">
        <label className="block text-sm" htmlFor="q">
          Pesquisar por nome ou NIF
          <input
            id="q"
            name="q"
            defaultValue={q}
            className="mt-1 w-full max-w-md rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-navy"
          />
        </label>
      </form>

      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-card p-6 text-muted">
          Nenhum cliente corresponde à pesquisa.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">NIF</th>
                <th className="px-4 py-3">IRC / IVA</th>
                <th className="px-4 py-3 text-right">Avença 2027, correntes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client, year, summary }) => {
                return (
                  <tr key={client.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <Link href={`/clientes/${client.id}`} className="font-medium text-navy hover:underline">
                        {client.name}
                      </Link>
                      <div className="text-xs text-muted">{client.legalForm}</div>
                    </td>
                    <td className="px-4 py-3">{client.nif || "—"}</td>
                    <td className="px-4 py-3">
                      {client.ircRegime || "—"} / {client.ivaRegime || "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{year ? eur(summary.subtotalCorrente) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
