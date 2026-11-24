import type { Client } from "@/lib/types";

const field = "space-y-1";
const label = "text-sm font-medium text-ink";
const input =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none ring-navy/30 focus:border-navy focus:ring-2";

export function ClientForm({
  action,
  client,
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  client?: Client;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      {client ? <input type="hidden" name="id" value={client.id} /> : null}
      <div className={`${field} md:col-span-2`}>
        <label className={label} htmlFor="name">Nome</label>
        <input id="name" name="name" required defaultValue={client?.name ?? ""} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="nif">NIF</label>
        <input id="nif" name="nif" inputMode="numeric" defaultValue={client?.nif ?? ""} placeholder="9 dígitos, se conhecido" className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="legalForm">Forma jurídica</label>
        <input id="legalForm" name="legalForm" defaultValue={client?.legalForm ?? ""} className={input} />
      </div>
      <div className={`${field} md:col-span-2`}>
        <label className={label} htmlFor="object">Objeto</label>
        <input id="object" name="object" defaultValue={client?.object ?? ""} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="ircRegime">Regime de IRC</label>
        <input id="ircRegime" name="ircRegime" defaultValue={client?.ircRegime ?? ""} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="ivaRegime">Regime de IVA</label>
        <input id="ivaRegime" name="ivaRegime" defaultValue={client?.ivaRegime ?? ""} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="capital">Capital social (€)</label>
        <input id="capital" name="capital" defaultValue={client?.capital ?? ""} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="partners">Sócios</label>
        <input id="partners" name="partners" defaultValue={client?.partners ?? ""} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="bankAccounts">Contas bancárias</label>
        <input id="bankAccounts" name="bankAccounts" defaultValue={client?.bankAccounts ?? ""} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="expectedTurnover">Volume de negócios esperado (€)</label>
        <input id="expectedTurnover" name="expectedTurnover" defaultValue={client?.expectedTurnover ?? ""} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="employeesExManager">Colaboradores, sem o sócio-gerente</label>
        <input id="employeesExManager" name="employeesExManager" defaultValue={client?.employeesExManager ?? 0} className={input} />
      </div>
      <div className={field}>
        <label className={label} htmlFor="situationDate">Data da situação</label>
        <input id="situationDate" name="situationDate" type="date" defaultValue={client?.situationDate ?? ""} className={input} />
      </div>
      <div className={`${field} md:col-span-2`}>
        <label className={label} htmlFor="notes">Notas</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={client?.notes ?? ""} className={input} />
      </div>
      <div className="md:col-span-2">
        <button type="submit" className="rounded-md bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-deep">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
