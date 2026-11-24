import "@/pdf/standard-fonts";
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
import { eur } from "@/lib/format";
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
    paddingTop: 104,
    paddingBottom: 36,
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
  const pages = sections.flatMap((section) => {
    if (section.kind === "cover") {
      return [
        <Page key={section.id} size="A4" orientation="landscape" style={styles.cover}>
          <Cover section={section} dateLabel={dateLabel} logoSrc={logoSrc} clientLogoSrc={clientLogoSrc} />
        </Page>,
      ];
    }
    const slide = (key: string, title: string, body: ReactNode, mode: "center" | "fill" | "flow" = "center") => (
      <Page key={key} size="A4" orientation="landscape" style={styles.page} wrap>
        <Header logoSrc={logoSrc} />
        <Text style={styles.h1} fixed>{title}</Text>
        <View style={mode === "flow" ? undefined : { flex: 1, justifyContent: mode === "center" ? "center" : "flex-start" }}>
          {body}
        </View>
        <PageNumber />
      </Page>
    );
    if (section.kind === "conditions") {
      return [slide(section.id, section.title, <ConditionsFlow section={section} />, "flow")];
    }
    return slidesOf([section]).flatMap((part) => {
      if (part.kind === "honorarios") {
        return [
          slide(`${part.id}-historico`, "Avenças já praticadas", <HistoryBars rows={history} year={year} />),
          slide(part.id, part.title, <FeeTable summary={summary} intro={part.intro} />, "fill"),
        ];
      }
      return [slide(part.id, part.title, <SectionBody section={part} summary={summary} ruHeadcount={ruHeadcount} ruTiers={ruTiers} />)];
    });
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
    return <StepRow subtitle={section.subtitle} columns={section.columns} />;
  }
  if (section.kind === "honorarios") {
    return <FeeTable summary={summary} intro={section.intro} />;
  }
  if (section.kind === "ru") {
    return (
      <View>
        {section.intro ? <Text style={[styles.body, { textAlign: "center", marginBottom: 16 }]}>{section.intro}</Text> : null}
        <RuBars headcount={ruHeadcount} tiers={ruTiers} />
      </View>
    );
  }
  if (section.kind === "conditions") {
    return <ConditionsFlow section={section} />;
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

const FEE_FLEX = [1.8, 1, 1, 1, 1, 1];

function FeeCell({ flex, children, header, align }: { flex: number; children: string; header?: boolean; align: "left" | "center" }) {
  return (
    <View style={{ flex, paddingHorizontal: 4, justifyContent: "center", backgroundColor: header ? navy : undefined }}>
      <Text style={{ fontSize: header ? 8 : 9, color: header ? "#ffffff" : "#1c2430", fontFamily: header ? "Helvetica-Bold" : "Helvetica", textAlign: align }}>
        {children}
      </Text>
    </View>
  );
}

function FeeTable({ summary, intro }: { summary: Summary; intro: string }) {
  const headers = ["Serviço", "Mensal", "Trimestral", "Anual", "One Shot", "Valor anual"];
  const contentHeight = 595.28 - 104 - 40;
  const chrome = (intro ? 28 : 0) + 28;
  const rowHeight = Math.max(20, (contentHeight - chrome) / Math.max(summary.lines.length, 1));
  return (
    <View style={{ flex: 1, paddingTop: 8 }}>
      {intro ? <Text style={{ fontSize: 10, marginBottom: 12, textAlign: "center" }}>{intro}</Text> : null}
      <View style={{ flexDirection: "row", backgroundColor: navy, minHeight: 22, alignItems: "center" }}>
        {headers.map((header, index) => (
          <FeeCell key={header} flex={FEE_FLEX[index] ?? 1} header align="center">{header}</FeeCell>
        ))}
      </View>
      {summary.lines.map((fee, index) => {
        const cells = ["—", "—", "—", "—"];
        const value = periodText(fee);
        if (fee.periodicity === "mensal") cells[0] = value;
        if (fee.periodicity === "trimestral") cells[1] = value;
        if (fee.periodicity === "anual") cells[2] = value;
        if (fee.periodicity === "one_shot") cells[3] = value;
        const shown = [fee.description, ...cells, annualText(fee)];
        return (
          <View key={`${fee.description}-${index}`} style={{ flexDirection: "row", alignItems: "center", height: rowHeight, backgroundColor: index % 2 ? paper : "#ffffff", borderBottomWidth: 0.4, borderBottomColor: line }}>
            {shown.map((cell, cellIndex) => (
              <FeeCell key={`${fee.description}-${cellIndex}`} flex={FEE_FLEX[cellIndex] ?? 1} align={cellIndex === 0 ? "left" : "center"}>
                {cell}
              </FeeCell>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function RuBars({ headcount, tiers }: { headcount: number | null; tiers: readonly RuTier[] }) {
  const max = Math.max(1, ...tiers.map((tier) => tier.annual));
  const active = tiers.find((tier) => headcount != null && headcount >= tier.min && (tier.max == null || headcount <= tier.max));
  const chartHeight = 230;
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[styles.h2, { textAlign: "center", marginBottom: 18 }]}>Escalões · colaboradores sem o sócio-gerente: {headcount ?? 0}</Text>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center" }}>
        {tiers.map((tier) => {
          const on = active?.label === tier.label;
          return (
            <View key={tier.label} style={{ width: 108, alignItems: "center", marginHorizontal: 6 }}>
              <Text style={{ fontSize: 11, marginBottom: 8, fontFamily: "Helvetica-Bold", color: on ? "#8d2f39" : navy }}>{eur(tier.annual)}</Text>
              <View style={{ width: 62, height: Math.max((tier.annual / max) * chartHeight, 14), backgroundColor: on ? "#8d2f39" : navy }} />
              <Text style={{ fontSize: 9, marginTop: 8, textAlign: "center" }}>{tier.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function StepRow({ subtitle, columns }: { subtitle: string; columns: { title: string; items: string[] }[] }) {
  return (
    <View>
      {subtitle ? <Text style={{ fontSize: 10, color: muted, textAlign: "center", marginBottom: 14 }}>{subtitle}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        {columns.map((column, index) => (
          <View key={column.title} style={{ flex: 1, flexDirection: "row", alignItems: "stretch" }}>
            <View style={{ flex: 1, borderWidth: 1.2, borderColor: navy, backgroundColor: paper, paddingHorizontal: 8, paddingVertical: 10 }}>
              <Text style={{ fontSize: 11, color: navy, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 8 }}>{column.title}</Text>
              {column.items.map((item) => (
                <Text key={item} style={{ fontSize: 8, lineHeight: 1.35, marginBottom: 4 }}>• {item}</Text>
              ))}
            </View>
            {index < columns.length - 1 ? <FlowArrow /> : <View style={{ width: 22 }} />}
          </View>
        ))}
      </View>
    </View>
  );
}

function FlowArrow() {
  return (
    <View style={{ width: 22, justifyContent: "center", alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 10, height: 2, backgroundColor: navy }} />
        <View style={{ width: 0, height: 0, borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 7, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: navy }} />
      </View>
    </View>
  );
}

function ConditionsFlow({ section }: { section: Extract<ProposalSection, { kind: "conditions" }> }) {
  return (
    <View style={{ paddingTop: 8 }}>
      {section.lead.trim() ? (
        <Text style={{ fontSize: 11, lineHeight: 1.45, textAlign: "justify", marginBottom: 16 }}>{section.lead}</Text>
      ) : null}
      {section.clauses.map((clause) => (
        <View key={clause.titulo} style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 12, color: navy, fontFamily: "Helvetica-Bold", marginBottom: 8 }} minPresenceAhead={36}>{clause.titulo}</Text>
          {clause.corpo.split(/\n+/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => (
            <Text key={`${clause.titulo}-${index}`} style={{ fontSize: 10, lineHeight: 1.45, textAlign: "justify", marginBottom: 6 }}>{paragraph.trim()}</Text>
          ))}
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
