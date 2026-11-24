import Link from "next/link";
import { ConfiguracaoAvencasForm } from "@/components/ConfiguracaoAvencasForm";
import { getAvencaConfig } from "@/lib/queries";
import { requireViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function ParametersPage() {
  if (!(await requireViewer())) return null;
  const config = await getAvencaConfig();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-[#8d2f39]">Geral</p>
        <h1 className="font-serif text-4xl text-navy">Parâmetros da avença</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Arraste cada barra. Estes coeficientes e ponderações entram no rating, na avença teórica e na revisão anual de todos os clientes.
        </p>
      </div>
      <ConfiguracaoAvencasForm key={JSON.stringify(config)} config={config} />
      <p className="text-sm text-muted">
        Os outros serviços da proposta continuam em <Link href="/tabela" className="text-navy underline">Tabela de preços</Link>.
      </p>
    </div>
  );
}
