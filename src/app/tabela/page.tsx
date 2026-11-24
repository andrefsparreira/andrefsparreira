import Link from "next/link";
import { deactivateServiceType, saveServiceType } from "@/app/actions";
import { eur, INCLUSION_LABEL, PERIOD_LABEL, RULE_LABEL } from "@/lib/format";
import { RU_TIERS, TARIFF_NOTES } from "@/lib/pricing";
import { listTypes } from "@/lib/queries";
import { requireViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm";

export default async function TariffPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  if (!(await requireViewer())) return null;
  const sp = await searchParams;
  const types = await listTypes(true);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-4xl text-navy">Tabela de preços</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Valores lidos de proposta-modelo.xlsx, folhas Honorários, RU e Nota. A avença mensal de 150,00 € é o valor do cliente de exemplo, não um mínimo de tabela. A menção «desde 80,00 €» corresponde ao Relatório Único, escalão de 1 a 5 colaboradores.
        </p>
        {sp.ok === "tipo" ? <p className="mt-2 text-sm text-navy">Tipo de serviço guardado.</p> : null}
        {sp.erro === "tipo" ? <p className="mt-2 text-sm text-[#8d2f39]">Indique o nome do tipo.</p> : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-white">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-navy text-left text-white">
            <tr>
              <th className="px-3 py-2">Serviço</th>
              <th className="px-3 py-2">Regra</th>
              <th className="px-3 py-2">Origem</th>
            </tr>
          </thead>
          <tbody>
            {TARIFF_NOTES.map((row) => (
              <tr key={row.origem} className="border-t border-line">
                <td className="px-3 py-2 font-medium">{row.servico}</td>
                <td className="px-3 py-2">{row.regra}</td>
                <td className="px-3 py-2 text-muted">{row.origem}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted">
        Os parâmetros da avença base estão em <Link href="/parametros" className="text-navy underline">Parâmetros</Link>.
      </p>

      <section>
        <h2 className="mb-3 font-serif text-2xl text-navy">Relatório Único</h2>
        <div className="grid gap-2 sm:grid-cols-5">
          {RU_TIERS.map((tier) => (
            <div key={tier.label} className="rounded-xl border border-line bg-white p-3">
              <div className="text-xs uppercase tracking-wide text-muted">{tier.label}</div>
              <div className="mt-1 font-serif text-xl text-navy">{eur(tier.annual)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl text-navy">Tipos de linha</h2>
        <p className="text-sm text-muted">Os tipos são editáveis. As linhas já lançadas guardam a regra que tinham no momento.</p>
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead className="bg-paper text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Periodicidade</th>
                <th className="px-3 py-2">Regra</th>
                <th className="px-3 py-2">Inclusão</th>
                <th className="px-3 py-2">Valor base</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {types.filter((type) => type.active).map((type) => (
                <tr key={type.code} className="border-t border-line">
                  <td className="px-3 py-2">{type.label}</td>
                  <td className="px-3 py-2">{PERIOD_LABEL[type.defaultPeriodicity]}</td>
                  <td className="px-3 py-2">{RULE_LABEL[type.pricingRule]}</td>
                  <td className="px-3 py-2">{INCLUSION_LABEL[type.defaultInclusion]}{type.defaultOptional ? " · opcional" : ""}</td>
                  <td className="px-3 py-2">{type.defaultUnitValue == null ? "—" : eur(type.defaultUnitValue)}</td>
                  <td className="px-3 py-2">
                    <form action={deactivateServiceType}>
                      <input type="hidden" name="code" value={type.code} />
                      <button className="text-xs text-[#8d2f39]">Desativar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={saveServiceType} className="grid gap-3 rounded-xl border border-line bg-card p-4 md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            Novo tipo ou código existente para atualizar
            <input name="label" placeholder="Nome do serviço" className={input} />
          </label>
          <label className="text-sm">
            Código (opcional)
            <input name="code" placeholder="deixa vazio para criar" className={input} />
          </label>
          <label className="text-sm">
            Periodicidade
            <select name="periodicity" className={input} defaultValue="mensal">
              {Object.entries(PERIOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Regra de cálculo
            <select name="pricingRule" className={input} defaultValue="fixed">
              {Object.entries(RULE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Inclusão
            <select name="inclusion" className={input} defaultValue="valor">
              {Object.entries(INCLUSION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm">
            Valor base (€)
            <input name="unitValue" className={input} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="optional" /> Opcional
          </label>
          <div className="md:col-span-3">
            <button className="rounded-md bg-navy px-4 py-2 text-sm text-white">Guardar tipo</button>
          </div>
        </form>
      </section>
    </div>
  );
}
