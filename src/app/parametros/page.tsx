import Link from "next/link";
import { RetainerParameters } from "@/components/RetainerParameters";
import { getRetainerBase, listRetainerCatalog } from "@/lib/queries";
import { requireViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

export default async function ParametersPage() {
  if (!(await requireViewer())) return null;
  const catalog = await listRetainerCatalog();
  const baseAmount = await getRetainerBase();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-[#8d2f39]">Geral</p>
        <h1 className="font-serif text-4xl text-navy">Parâmetros da avença</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Estes parâmetros valem para todos os clientes e entram só no cálculo da avença base. Na ficha de cada cliente escolhe-se a quantidade de documentos, a faturação e os restantes valores.
        </p>
      </div>
      <RetainerParameters
        key={catalog.map((parameter) => `${parameter.id}:${parameter.values.map((value) => `${value.id}:${value.amount}`).join(",")}`).join("|") + baseAmount}
        baseAmount={baseAmount}
        parameters={catalog}
      />
      <p className="text-sm text-muted">
        A tabela dos outros serviços continua em <Link href="/tabela" className="text-navy underline">Tabela de preços</Link>.
      </p>
    </div>
  );
}
