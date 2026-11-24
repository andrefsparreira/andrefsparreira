import { deactivateServiceType, saveRuTiers, saveServiceType } from "@/app/actions";
import { ConfiguracaoAvencasForm } from "@/components/ConfiguracaoAvencasForm";
import { INCLUSION_LABEL, PERIOD_LABEL, RULE_LABEL } from "@/lib/format";
import { RU_TIERS } from "@/lib/pricing";
import { getAvencaConfig, getRuTiers, listTypes } from "@/lib/queries";
import { requireViewer } from "@/lib/viewer";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  if (!(await requireViewer())) return null;
  const sp = await searchParams;
  const types = await listTypes(true);
  const config = await getAvencaConfig();
  const tiers = await getRuTiers();

  return (
    <div className="space-y-10">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-[#8d2f39]">Geral</p>
        <h1 className="font-serif text-4xl text-navy">Definições</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Parâmetros da avença, escalões do Relatório Único e tipos de linha. As linhas já lançadas guardam a regra que tinham no momento.
        </p>
        {sp.ok === "tipo" ? <p className="mt-2 text-sm text-navy">Tipo de serviço guardado.</p> : null}
        {sp.erro === "tipo" ? <p className="mt-2 text-sm text-[#8d2f39]">Indique o nome do tipo.</p> : null}
        {sp.ok === "ru" ? <p className="mt-2 text-sm text-navy">Escalões do Relatório Único guardados.</p> : null}
        {sp.erro === "ru" ? <p className="mt-2 text-sm text-[#8d2f39]">Cada escalão precisa de um valor zero ou positivo.</p> : null}
      </div>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl text-navy">Parâmetros da avença</h2>
        <ConfiguracaoAvencasForm key={JSON.stringify(config)} config={config} />
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl text-navy">Relatório Único</h2>
        <p className="text-sm text-muted">
          Valor anual de cada escalão de colaboradores, sem o sócio-gerente. O primeiro escalão é o «desde» quando não há colaboradores extra.
        </p>
        <form action={saveRuTiers} className="grid gap-3 sm:grid-cols-5">
          {RU_TIERS.map((tier, index) => (
            <label key={tier.label} className="rounded-xl border border-line bg-white p-3 text-sm">
              <span className="text-xs uppercase tracking-wide text-muted">{tier.label}</span>
              <input
                name={`annual_${index}`}
                defaultValue={String(tiers[index]?.annual ?? tier.annual).replace(".", ",")}
                inputMode="decimal"
                aria-label={`Valor anual do escalão ${tier.label}`}
                className={input}
              />
              <span className="mt-1 block text-xs text-muted">€ por ano</span>
            </label>
          ))}
          <div className="sm:col-span-5">
            <button className="rounded-md bg-navy px-4 py-2 text-sm text-white">Guardar escalões</button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl text-navy">Tipos de linha</h2>
        <div className="space-y-3">
          {types.filter((type) => type.active).map((type) => (
            <form key={type.code} action={saveServiceType} className="grid items-end gap-3 rounded-xl border border-line bg-white p-3 md:grid-cols-6">
              <input type="hidden" name="code" value={type.code} />
              <label className="text-sm md:col-span-2">
                Tipo
                <input name="label" defaultValue={type.label} className={input} />
              </label>
              <label className="text-sm">
                Periodicidade
                <select name="periodicity" defaultValue={type.defaultPeriodicity} className={input}>
                  {Object.entries(PERIOD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Regra
                <select name="pricingRule" defaultValue={type.pricingRule} className={input}>
                  {Object.entries(RULE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Inclusão
                <select name="inclusion" defaultValue={type.defaultInclusion} className={input}>
                  {Object.entries(INCLUSION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm">
                Valor base (€)
                <input name="unitValue" defaultValue={type.defaultUnitValue ?? ""} className={input} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="optional" defaultChecked={type.defaultOptional} /> Opcional
              </label>
              <div>
                <button className="rounded-md bg-navy px-3 py-1.5 text-sm text-white">Guardar</button>
              </div>
            </form>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {types.filter((type) => type.active).map((type) => (
            <form key={`${type.code}-remove`} action={deactivateServiceType}>
              <input type="hidden" name="code" value={type.code} />
              <button className="text-xs text-[#8d2f39]">Desativar {type.label}</button>
            </form>
          ))}
        </div>

        <form action={saveServiceType} className="grid gap-3 rounded-xl border border-line bg-card p-4 md:grid-cols-3">
          <h3 className="font-serif text-xl text-navy md:col-span-3">Novo tipo</h3>
          <label className="text-sm md:col-span-2">
            Nome
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
            <button className="rounded-md bg-navy px-4 py-2 text-sm text-white">Criar tipo</button>
          </div>
        </form>
      </section>
    </div>
  );
}
