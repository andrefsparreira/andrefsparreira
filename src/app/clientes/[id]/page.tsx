import Link from "next/link";
import { notFound } from "next/navigation";
import { createYear, deleteClient, loadModelLines, openProposal, updateClient } from "@/app/actions";
import { AvaliacaoCliente } from "@/components/AvaliacaoCliente";
import { ClientForm } from "@/components/ClientForm";
import { FeeEditor } from "@/components/FeeEditor";
import { RetainerHistory } from "@/components/RetainerHistory";
import { eur, formatDatePT } from "@/lib/format";
import { computeSummary } from "@/lib/pricing";
import { displayedMonthly, findProposal, getAvencaConfig, getClient, getLines, getVatRate, getYear, listTypes, listYears, retainerHistory } from "@/lib/queries";
import { requireViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ano?: string; ok?: string; erro?: string; sep?: string }>;
}) {
  if (!(await requireViewer())) return null;
  const { id } = await params;
  const sp = await searchParams;
  const client = await getClient(Number(id));
  if (!client) notFound();
  const requested = Number(sp.ano || 2027);
  const requestedYear = Number.isInteger(requested) ? requested : 2027;
  const existing = await listYears(client.id);
  const anchor = Math.max(2027, requestedYear, ...existing.map((item) => item.year));
  const history = await retainerHistory(client.id, anchor);
  const years = await listYears(client.id);
  const year = years.find((item) => item.year === requested) ?? years[years.length - 1] ?? null;
  const lines = year ? await getLines(year.id) : [];
  const types = await listTypes();
  const vatRate = await getVatRate();
  const summary = computeSummary(lines, vatRate);
  const proposal = year ? await findProposal(client.id, year.year) : null;
  const separador = sp.sep === "avaliacao" || sp.sep === "honorarios" ? sp.sep : "ficha";
  const anterior = year ? await getYear(client.id, year.year - 1) : null;
  const avencaAnterior = anterior ? displayedMonthly(anterior, await getLines(anterior.id)) : null;
  const config = separador === "avaliacao" ? await getAvencaConfig() : null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-navy hover:underline">Clientes</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-4xl text-navy">{client.name}</h1>
            <p className="mt-1 text-sm text-muted">
              Situação a {formatDatePT(client.situationDate)}
              {client.nif ? ` · NIF ${client.nif}` : " · NIF não indicado no modelo"}
            </p>
          </div>
          {year ? (
            proposal ? (
              <Link href={`/propostas/${proposal.id}`} className="rounded-md bg-navy px-4 py-2 text-sm text-white">
                Abrir proposta {year.year}
              </Link>
            ) : (
              <form action={openProposal}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="year" value={year.year} />
                <button className="rounded-md bg-navy px-4 py-2 text-sm text-white">Preparar proposta {year.year}</button>
              </form>
            )
          ) : null}
        </div>
        <Notice ok={sp.ok} erro={sp.erro} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Tab href={`/clientes/${client.id}?ano=${year?.year ?? requestedYear}`} ativo={separador === "ficha"}>Ficha</Tab>
        <Tab href={`/clientes/${client.id}?ano=${year?.year ?? requestedYear}&sep=avaliacao`} ativo={separador === "avaliacao"}>Avaliação e avenças</Tab>
        <Tab href={`/clientes/${client.id}?ano=${year?.year ?? requestedYear}&sep=honorarios`} ativo={separador === "honorarios"}>Honorários</Tab>
      </div>

      <div className="flex flex-wrap gap-2">
        {years.map((item) => (
          <Link
            key={item.id}
            href={`/clientes/${client.id}?ano=${item.year}${separador === "ficha" ? "" : `&sep=${separador}`}`}
            className={`rounded-full px-3 py-1 text-sm ${item.id === year?.id ? "bg-navy text-white" : "bg-white text-navy"}`}
          >
            {item.year}
          </Link>
        ))}
      </div>

      {separador === "ficha" ? (
      <section className="rounded-xl border border-line bg-card p-6">
        <h2 className="mb-4 font-serif text-2xl text-navy">Ficha</h2>
        <ClientForm action={updateClient} client={client} submitLabel="Guardar ficha" />
        <form action={deleteClient} className="mt-4">
          <input type="hidden" name="id" value={client.id} />
          <button className="text-sm text-[#8d2f39]">Eliminar cliente</button>
        </form>
      </section>
      ) : null}

      {separador === "avaliacao" && year && config ? (
        <>
          <AvaliacaoCliente
            key={`${year.id}-${anterior?.id ?? 0}-${avencaAnterior ?? ""}-${year.approvalStatus}`}
            clientId={client.id}
            year={year.year}
            avencaAnterior={avencaAnterior}
            config={config}
            atual={{
              faturacao: year.turnover,
              documentos: year.docCount,
              organizacao: year.organizationLevel,
              contabilizacao: year.accountingLevel,
            }}
            anterior={{
              faturacao: anterior?.turnover ?? null,
              documentos: anterior?.docCount ?? null,
              organizacao: anterior?.organizationLevel ?? null,
              contabilizacao: anterior?.accountingLevel ?? null,
            }}
            approvalStatus={year.approvalStatus}
            approvedRetainer={year.approvedRetainer}
          />
          <RetainerHistory
            key={history.map((row) => `${row.year}:${row.monthly ?? ""}`).join("|")}
            clientId={client.id}
            proposalYear={anchor}
            rows={history}
          />
        </>
      ) : null}
      {separador === "avaliacao" && !year ? <p className="text-sm text-muted">Crie um ano em Honorários para lançar a avaliação.</p> : null}

      {separador === "honorarios" ? (
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-2xl text-navy">Linhas de honorários</h2>
          {year ? (
            <p className="text-sm text-muted">
              Valor anual corrente em {year.year}: {eur(summary.subtotalCorrente)}. Com IVA: {eur(summary.totalCorrenteComIva)}.
            </p>
          ) : (
            <p className="text-sm text-muted">Ainda sem anos.</p>
          )}
        </div>
        {year ? <p className="text-sm text-muted">{year.note}</p> : null}
        <form action={createYear} className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-white p-3 text-sm">
          <input type="hidden" name="clientId" value={client.id} />
          <label>
            Novo ano
            <input name="year" defaultValue={2028} className="mt-1 block w-28 rounded-md border border-line px-2 py-1.5" />
          </label>
          <label>
            Copiar de
            <select name="copyFrom" className="mt-1 block rounded-md border border-line px-2 py-1.5">
              <option value="">Não copiar</option>
              {years.map((item) => (
                <option key={item.id} value={item.id}>{item.year}</option>
              ))}
            </select>
          </label>
          <button className="rounded-md border border-navy px-3 py-1.5 text-navy">Criar ano</button>
        </form>
        {year ? (
          <>
            <form action={loadModelLines}>
              <input type="hidden" name="clientId" value={client.id} />
              <input type="hidden" name="year" value={year.year} />
              <button className="text-sm text-navy underline">
                Substituir as linhas deste ano pelos serviços do modelo
              </button>
            </form>
            <FeeEditor
              key={`${year.id}-${lines.map((line) => `${line.id}:${line.unitValue ?? ""}:${line.notes}`).join("|")}`}
              yearId={year.id}
              lines={lines}
              types={types}
              vatRate={vatRate}
              employees={client.employeesExManager}
            />
          </>
        ) : null}
      </section>
      ) : null}
    </div>
  );
}

function Tab({ href, ativo, children }: { href: string; ativo: boolean; children: string }) {
  return (
    <Link href={href} className={`rounded-full px-3 py-1 text-sm ${ativo ? "bg-navy text-white" : "bg-white text-navy"}`}>
      {children}
    </Link>
  );
}

function Notice({ ok, erro }: { ok?: string; erro?: string }) {
  if (erro === "nome") return <p className="mt-3 text-sm text-[#8d2f39]">Indique o nome do cliente.</p>;
  if (erro === "nif") return <p className="mt-3 text-sm text-[#8d2f39]">O NIF, quando preenchido, tem 9 dígitos.</p>;
  if (erro === "ano") return <p className="mt-3 text-sm text-[#8d2f39]">Indique um ano entre 2000 e 2100.</p>;
  if (ok === "ficha") return <p className="mt-3 text-sm text-navy">Ficha guardada.</p>;
  if (ok === "criado") return <p className="mt-3 text-sm text-navy">Cliente criado. O ano 2027 ficou preparado.</p>;
  if (ok === "modelo") return <p className="mt-3 text-sm text-navy">Serviços do modelo carregados. A avença mensal fica por preencher.</p>;
  return null;
}
