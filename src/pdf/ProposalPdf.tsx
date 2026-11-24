import path from "node:path";
import type { ReactNode } from "react";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { eur, pct } from "@/lib/format";
import { RU_TIERS, type ComputedLine, type RuTier, type Summary } from "@/lib/pricing";
import { slidesOf } from "@/lib/slides";
import type { ProposalSection, RetainerSnapshot } from "@/lib/types";

Font.registerHyphenationCallback((word) => [word]);

const navy = "#002060";
const muted = "#5e6874";
const line = "#e4ddd2";
const paper = "#f6f3ee";

const styles = StyleSheet.create({
  page: {
    paddingTop: 78,
    paddingBottom: 32,
    paddingHorizontal: 32,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1c2430",
    backgroundColor: "#ffffff",
  },
  cover: {
    padding: 0,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  footer: {
    position: "absolute",
    bottom: 12,
    right: 28,
    fontSize: 9,
    color: muted,
  },
  kicker: { fontSize: 11, color: "#8d2f39", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },
  h1: { position: "absolute", top: 50, left: 32, right: 36, fontSize: 18, color: navy, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 12, color: navy, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  body: { fontSize: 11, lineHeight: 1.45, marginTop: 8 },
  bullet: { fontSize: 11, lineHeight: 1.4, marginBottom: 4 },
  small: { fontSize: 9, lineHeight: 1.4, color: "#1c2430" },
  th: {
    backgroundColor: navy,
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    padding: 4,
  },
  td: { fontSize: 8, padding: 4, borderBottomWidth: 0.4, borderBottomColor: line },
});

export function ProposalDocument({
  clientName,
  year,
  dateLabel,
  sections,
  summary,
  logoSrc,
  clientLogoSrc,
  ruHeadcount,
  history,
  ruTiers = RU_TIERS,
}: {
  clientName: string;
  year: number;
  dateLabel: string;
  sections: ProposalSection[];
  summary: Summary;
  logoSrc: string | null;
  clientLogoSrc: string | null;
  ruHeadcount: number | null;
  history: RetainerSnapshot[];
  ruTiers?: readonly RuTier[];
}) {
  const pages = slidesOf(sections).flatMap((section) => {
    if (section.kind === "cover") {
      return [
        <Page key={section.id} size="A4" orientation="landscape" style={styles.cover}>
          <Cover section={section} dateLabel={dateLabel} logoSrc={logoSrc} clientLogoSrc={clientLogoSrc} />
        </Page>,
      ];
    }
    const slide = (key: string, title: string, body: ReactNode, wrap = true) => (
      <Page key={key} size="A4" orientation="landscape" style={styles.page} wrap={wrap}>
        <Header logoSrc={logoSrc} />
        <Text style={styles.h1} fixed>{title}</Text>
        {body}
        <PageNumber />
      </Page>
    );
    if (section.kind === "honorarios") {
      return [
        slide(`${section.id}-historico`, "Avenças já praticadas", <HistoryBars rows={history} year={year} />),
        slide(section.id, section.title, <FeeTable summary={summary} intro={section.intro} />),
      ];
    }
    return [slide(section.id, section.title, <SectionBody section={section} summary={summary} ruHeadcount={ruHeadcount} ruTiers={ruTiers} />)];
  });

  return (
    <Document title={`Proposta ${year} · ${clientName}`} author="KS Consultores" creator="KS Consultores" producer="KS Consultores">
      {pages}
    </Document>
  );
}

function PageNumber() {
  return (
    <Text
      style={styles.footer}
      fixed
      render={({ pageNumber }) => String(pageNumber - 1)}
    />
  );
}

function HistoryBars({ rows, year }: { rows: RetainerSnapshot[]; year: number }) {
  const max = Math.max(1, ...rows.map((row) => row.monthly ?? 0));
  return (
    <View>
      <Text style={styles.body}>Valores mensais dos cinco anos anteriores a {year}.</Text>
      {rows.map((row) => (
        <View key={row.year} style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
          <Text style={{ width: 48, fontSize: 11, color: navy }}>{row.year}</Text>
          <View style={{ width: Math.max(((row.monthly ?? 0) / max) * 280, row.monthly ? 4 : 0), height: 10, backgroundColor: navy }} />
          <Text style={{ marginLeft: 8, fontSize: 10 }}>
            {row.monthly == null ? "por lançar" : `${eur(row.monthly)} / mês · ${eur(row.annual ?? 0)} / ano`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Header({ logoSrc }: { logoSrc: string | null }) {
  return (
    <View fixed style={{ position: "absolute", top: 16, right: 32, height: 20, width: 110, alignItems: "flex-end" }}>
      {logoSrc ? <Image src={logoSrc} style={{ height: 18, width: 100, objectFit: "contain" }} /> : null}
    </View>
  );
}

function Cover({
  section,
  dateLabel,
  logoSrc,
  clientLogoSrc,
}: {
  section: Extract<ProposalSection, { kind: "cover" }>;
  dateLabel: string;
  logoSrc: string | null;
  clientLogoSrc: string | null;
}) {
  return (
    <View style={{ height: "100%", paddingTop: 36, paddingBottom: 28, paddingLeft: 42, paddingRight: 28 }}>
      {logoSrc ? <Image src={logoSrc} style={{ height: 36, width: 180, objectFit: "contain", alignSelf: "flex-start" }} /> : null}
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginTop: 36 }}>
        <View style={{ flex: 1.15, paddingRight: 28 }}>
          <Text style={styles.kicker}>{section.kicker}</Text>
          <Text style={{ fontSize: 26, color: navy, fontFamily: "Helvetica-Bold", lineHeight: 1.2 }}>{section.title}</Text>
          <Text style={{ marginTop: 18, fontSize: 12, lineHeight: 1.45 }}>{section.tagline}</Text>
        </View>
        <View style={{ flex: 0.85, height: "80%", backgroundColor: "#e7eef8", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
          {clientLogoSrc ? <Image src={clientLogoSrc} style={{ width: 220, height: 170, objectFit: "contain" }} /> : null}
        </View>
      </View>
      <Text style={{ fontSize: 10, color: muted, marginTop: 12 }}>{dateLabel}</Text>
    </View>
  );
}

function SectionBody({
  section,
  summary,
  ruHeadcount,
  ruTiers,
}: {
  section: ProposalSection;
  summary: Summary;
  ruHeadcount: number | null;
  ruTiers: readonly RuTier[];
}) {
  if (section.kind === "prose") {
    return (
      <Text style={[styles.body, section.align === "justify" ? { textAlign: "justify", fontSize: 8.5, lineHeight: 1.32 } : {}]}>
        {section.body}
      </Text>
    );
  }
  if (section.kind === "bullets" || section.kind === "note") {
    return (
      <View style={{ marginTop: 8 }}>
        {section.kind === "bullets" && section.intro ? <Text style={styles.body}>{section.intro}</Text> : null}
        {section.bullets.map((bullet) => (
          <Text key={bullet} style={styles.bullet}>–  {bullet}</Text>
        ))}
      </View>
    );
  }
  if (section.kind === "columns") {
    return (
      <View>
        <Text style={{ fontSize: 10, color: muted, marginBottom: 8 }}>{section.subtitle}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {section.columns.map((column) => (
            <View key={column.title} style={{ flex: 1, backgroundColor: paper, padding: 8, borderRadius: 4 }}>
              <Text style={styles.h2}>{column.title}</Text>
              {column.items.map((item) => (
                <Text key={item} style={styles.small}>• {item}</Text>
              ))}
            </View>
          ))}
        </View>
      </View>
    );
  }
  if (section.kind === "honorarios") {
    return <FeeTable summary={summary} intro={section.intro} />;
  }
  if (section.kind === "ru") {
    return (
      <View>
        <Text style={styles.body}>{section.intro}</Text>
        <RuBars headcount={ruHeadcount} tiers={ruTiers} />
      </View>
    );
  }
  if (section.kind === "conditions") {
    return (
      <View>
        <Text style={styles.body}>{section.lead}</Text>
        {section.clauses.map((clause) => (
          <View key={clause.titulo} style={{ marginTop: 8 }}>
            <Text style={styles.h2}>{clause.titulo}</Text>
            <Text style={[styles.small, { textAlign: "justify" }]}>{clause.corpo}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (section.kind === "signature") {
    return (
      <View style={{ flexDirection: "row", gap: 16, marginTop: 24 }}>
        <View style={{ flex: 1, borderWidth: 0.6, borderColor: line, minHeight: 120, padding: 12 }}>
          <Text style={styles.h2}>{section.firm}</Text>
          <Text style={{ marginTop: 48, fontSize: 9, color: muted, textAlign: "center" }}>{section.note}</Text>
        </View>
        <View style={{ flex: 1, borderWidth: 0.6, borderColor: line, minHeight: 120, padding: 12 }}>
          <Text style={styles.h2}>O Cliente</Text>
          <Text style={{ marginTop: 48, fontSize: 9, color: muted, textAlign: "center" }}>aceitação e assinatura</Text>
        </View>
      </View>
    );
  }
  return null;
}

function euro(amount: number): string {
  return eur(amount).replace(" €", "\u00a0€");
}

function periodText(line: ComputedLine): string {
  if (line.pricingRule === "consultation" || line.inclusion === "sob_consulta") return "Sob consulta";
  if (line.pricingRule === "ru_tier" && line.periodAmount == null) return line.detail.replace(" €", "\u00a0€");
  if (line.detail.startsWith("Incluído") && (line.periodAmount == null || line.periodAmount === 0)) return "Incluído";
  if (line.periodAmount == null) return "—";
  return euro(line.periodAmount);
}

function annualText(line: ComputedLine): string {
  const current = periodText(line);
  if (current === "Incluído") return "Incluído";
  if (current === "Sob consulta" || current.startsWith("Desde") || line.annualAmount == null) return "—";
  return euro(line.annualAmount);
}

function FeeTable({ summary, intro }: { summary: Summary; intro: string }) {
  const headers = ["Serviço", "Mensal", "Trimestral", "Anual", "One Shot", "Valor anual"];
  const widths = [188, 112, 112, 100, 112, 114];
  return (
    <View>
      {intro ? <Text style={{ fontSize: 9, marginBottom: 6 }}>{intro}</Text> : null}
      <View style={{ flexDirection: "row" }}>
        {headers.map((header, index) => (
          <Text key={header} style={[styles.th, { width: widths[index] }]}>{header}</Text>
        ))}
      </View>
      {summary.lines.map((line, index) => {
        const cells = ["—", "—", "—", "—"];
        const value = periodText(line);
        if (line.periodicity === "mensal") cells[0] = value;
        if (line.periodicity === "trimestral") cells[1] = value;
        if (line.periodicity === "anual") cells[2] = value;
        if (line.periodicity === "one_shot") cells[3] = value;
        const shown = [line.description, ...cells, annualText(line)];
        return (
          <View key={`${line.description}-${index}`} style={{ flexDirection: "row", alignItems: "center", backgroundColor: index % 2 ? paper : "#ffffff" }}>
            {shown.map((cell, cellIndex) => (
              <Text key={`${line.description}-${cellIndex}`} style={[styles.td, { width: widths[cellIndex], textAlign: cellIndex === 0 ? "left" : "right" }]}>
                {cell}
              </Text>
            ))}
          </View>
        );
      })}
      <View style={{ marginTop: 6 }}>
        <Text style={{ fontSize: 8 }}>Correntes {euro(summary.subtotalCorrente)} · Opcionais {euro(summary.subtotalOpcional)} · IVA {pct(summary.vatRate)} {euro(summary.vatCorrente)} · Total com IVA {euro(summary.totalCorrenteComIva)} · Com opcionais {euro(summary.totalComOpcionais)}</Text>
      </View>
    </View>
  );
}

function RuBars({ headcount, tiers }: { headcount: number | null; tiers: readonly RuTier[] }) {
  const max = tiers[tiers.length - 1]?.annual || 1;
  const active = tiers.find((tier) => headcount != null && headcount >= tier.min && (tier.max == null || headcount <= tier.max));
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.h2}>Escalões · colaboradores sem o sócio-gerente: {headcount ?? 0}</Text>
      {tiers.map((tier) => (
        <View key={tier.label} style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          <Text style={{ width: 90, fontSize: 8, color: active?.label === tier.label ? "#8d2f39" : "#1c2430" }}>{tier.label}</Text>
          <View style={{ width: Math.max((tier.annual / max) * 240, 2), height: 8, backgroundColor: active?.label === tier.label ? "#8d2f39" : navy }} />
          <Text style={{ marginLeft: 6, fontSize: 8 }}>{eur(tier.annual)}</Text>
        </View>
      ))}
    </View>
  );
}

export function publicFile(src: string | null): string | null {
  if (!src || !src.startsWith("/brand/") || src.includes("..")) return null;
  const full = path.resolve(process.cwd(), "public", src.replace(/^\//, ""));
  const root = path.resolve(process.cwd(), "public");
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}
