export type Periodicity = "mensal" | "trimestral" | "anual" | "one_shot";
export type Inclusion = "valor" | "incluido" | "sob_consulta";
export type PricingRule =
  | "fixed"
  | "payroll"
  | "per_occurrence"
  | "ru_tier"
  | "included"
  | "consultation";

export type Client = {
  id: number;
  name: string;
  nif: string;
  legalForm: string;
  object: string;
  ircRegime: string;
  ivaRegime: string;
  capital: number | null;
  partners: string;
  bankAccounts: number | null;
  expectedTurnover: number | null;
  employeesExManager: number;
  situationDate: string | null;
  notes: string;
  logoPath: string | null;
};

export type ServiceType = {
  code: string;
  label: string;
  defaultPeriodicity: Periodicity;
  pricingRule: PricingRule;
  defaultInclusion: Inclusion;
  defaultOptional: boolean;
  defaultUnitValue: number | null;
  sortOrder: number;
  active: boolean;
};

export type ClientStatus = "atual" | "novo";
export type DocOrganization = "organizada" | "alguma" | "desorganizada" | "muito_desorganizada";
export type DocMedium = "digital" | "misto" | "fisico";

export type FeeYear = {
  id: number;
  clientId: number;
  year: number;
  note: string;
  monthlyRetainer: number | null;
  clientStatus: ClientStatus;
  docOrganization: DocOrganization;
  docCount: number | null;
  docMedium: DocMedium;
  turnover: number | null;
  manualAdjust: number;
};

export type RetainerSnapshot = {
  year: number;
  monthly: number | null;
  annual: number | null;
};

export type FeeLine = {
  id: number;
  yearId: number;
  sortOrder: number;
  typeCode: string;
  description: string;
  periodicity: Periodicity;
  quantity: number | null;
  inclusion: Inclusion;
  optional: boolean;
  unitValue: number | null;
  manual: boolean;
  pricingRule: PricingRule;
  notes: string;
};

export type LineDraft = {
  typeCode: string;
  description: string;
  periodicity: Periodicity;
  quantity: number | null;
  inclusion: Inclusion;
  optional: boolean;
  unitValue: number | null;
  manual: boolean;
  pricingRule: PricingRule;
  notes: string;
};

export type ProposalSection =
  | { id: string; kind: "cover"; title: string; kicker: string; tagline: string }
  | { id: string; kind: "prose"; title: string; body: string }
  | { id: string; kind: "bullets"; title: string; intro: string; bullets: string[] }
  | {
      id: string;
      kind: "columns";
      title: string;
      subtitle: string;
      columns: { title: string; items: string[] }[];
    }
  | { id: string; kind: "honorarios"; title: string; intro: string }
  | { id: string; kind: "ru"; title: string; intro: string }
  | { id: string; kind: "note"; title: string; bullets: string[] }
  | {
      id: string;
      kind: "conditions";
      title: string;
      lead: string;
      clauses: { titulo: string; corpo: string }[];
    }
  | { id: string; kind: "signature"; title: string; firm: string; note: string };

export type Proposal = {
  id: number;
  clientId: number;
  year: number;
  proposalDate: string;
  title: string;
  sections: ProposalSection[];
  updatedAt: string;
};
