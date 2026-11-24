import Link from "next/link";
import { createClient } from "@/app/actions";
import { ClientForm } from "@/components/ClientForm";

export const dynamic = "force-dynamic";

export default async function NewClientPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return (
    <div>
      <Link href="/" className="text-sm text-navy hover:underline">Voltar aos clientes</Link>
      <h1 className="mt-2 font-serif text-4xl text-navy">Novo cliente</h1>
      <Banner erro={erro} />
      <div className="mt-6 rounded-xl border border-line bg-card p-6">
        <ClientForm action={createClient} submitLabel="Criar cliente" />
      </div>
    </div>
  );
}

function Banner({ erro }: { erro?: string }) {
  if (erro === "nome") return <p className="mt-3 text-sm text-[#8d2f39]">Indique o nome do cliente.</p>;
  if (erro === "nif") return <p className="mt-3 text-sm text-[#8d2f39]">O NIF, quando preenchido, tem 9 dígitos.</p>;
  return null;
}
