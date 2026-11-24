import path from "node:path";
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
import { RU_TIERS, type Summary } from "@/lib/pricing";
import type { ProposalSection } from "@/lib/types";

Font.registerHyphenationCallback((word) => [word]);

const navy = "#002060";
const muted = "#5e6874";
const line = "#e4ddd2";
const paper = "#f6f3ee";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 42,
    paddingHorizontal: 36,
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
    bottom: 16,
    left: 36,
    right: 36,
    fontSize: 8,
    color: muted,
  },
  kicker: { fontSize: 9, color: navy, letterSpacing: 1, textTransform: "uppercase" },
  h1: { fontSize: 22, color: navy, fontFamily: "Helvetica-Bold", marginBottom: 8 },
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
}: {
  clientName: string;
  year: number;
  dateLabel: string;
  sections: ProposalSection[];
  summary: Summary;
  logoSrc: string;
  clientLogoSrc: string | null;
  ruHeadcount: number | null;
}) {
  return (
    <Document title={`Proposta ${year} · ${clientName}`} author="KS Consultores">
      {sections.map((section) =>
        section.kind === "cover" ? (
          <Page key={section.id} size="A4" orientation="landscape" style={styles.cover}>
            <Cover section={section} dateLabel={dateLabel} logoSrc={logoSrc} clientLogoSrc={clientLogoSrc} />
          </Page>
        ) : (
          <Page key={section.id} size="A4" orientation="landscape" style={styles.page} wrap>
            <Header clientName={clientName} logoSrc={logoSrc} />
            <Text style={styles.h1}>{section.title}</Text>
            <SectionBody section={section} summary={summary} ruHeadcount={ruHeadcount} />
            <Text style={styles.footer} fixed>
              KS Consultores · Proposta de prestação de serviços {year} · {clientName}
            </Text>
          </Page>
        ),
      )}
    </Document>
  );
}

function Header({ clientName, logoSrc }: { clientName: string; logoSrc: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Image src={logoSrc} style={{ height: 22, width: 120, objectFit: "contain" }} />
      <Text style={{ fontSize: 8, color: navy }}>{clientName}</Text>
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
  logoSrc: string;
  clientLogoSrc: string | null;
}) {
  return (
    <View style={{ flexDirection: "row", height: "100%" }}>
      <View style={{ flex: 1.35, padding: 42, justifyContent: "space-between" }}>
        <Image src={logoSrc} style={{ height: 42, width: 210, objectFit: "contain" }} />
        <View>
          <Text style={{ fontSize: 11, color: "#8d2f39", marginBottom: 8 }}>{section.kicker}</Text>
          <Text style={{ fontSize: 28, color: navy, fontFamily: "Helvetica-Bold", lineHeight: 1.2 }}>{section.title}</Text>
          <Text style={{ marginTop: 18, fontSize: 12, lineHeight: 1.45, maxWidth: 420 }}>{section.tagline}</Text>
        </View>
        <Text style={{ fontSize: 10, color: muted }}>{dateLabel}</Text>
      </View>
      <View style={{ flex: 0.75, backgroundColor: "#e7eef8", alignItems: "center", justifyContent: "center" }}>
        {clientLogoSrc ? <Image src={clientLogoSrc} style={{ width: 220, height: 180, objectFit: "contain" }} /> : null}
      </View>
    </View>
  );
}

function SectionBody({
  section,
  summary,
  ruHeadcount,
}: {
  section: ProposalSection;
  summary: Summary;
  ruHeadcount: number | null;
}) {
  if (section.kind === "prose") return <Text style={styles.body}>{section.body}</Text>;
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
    return (
      <View>
        <Text style={styles.body}>{section.intro}</Text>
        <FeeTable summary={summary} />
        <PdfBars summary={summary} />
      </View>
    );
  }
  if (section.kind === "ru") {
    return (
      <View>
        <Text style={styles.body}>{section.intro}</Text>
        <RuBars headcount={ruHeadcount} />
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
            <Text style={styles.small}>{clause.corpo}</Text>
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

function FeeTable({ summary }: { summary: Summary }) {
  const headers = ["Serviço", "Mensal", "Trimestral", "Anual", "One Shot", "Valor anual"];
  const widths = ["32%", "14%", "14%", "12%", "14%", "14%"];
  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: "row" }}>
        {headers.map((header, index) => (
          <Text key={header} style={[styles.th, { width: widths[index] }]}>{header}</Text>
        ))}
      </View>
      {summary.lines.map((line, index) => (
        <View key={`${line.description}-${index}`} style={{ flexDirection: "row", backgroundColor: index % 2 ? paper : "#ffffff" }}>
          <Text style={[styles.td, { width: widths[0] }]}>{line.description}{line.optional && !/opcional/i.test(line.description) ? " (opcional)" : ""}</Text>
          <Text style={[styles.td, { width: widths[1] }]}>{line.cells.mensal}</Text>
          <Text style={[styles.td, { width: widths[2] }]}>{line.cells.trimestral}</Text>
          <Text style={[styles.td, { width: widths[3] }]}>{line.cells.anual}</Text>
          <Text style={[styles.td, { width: widths[4] }]}>{line.cells.oneShot}</Text>
          <Text style={[styles.td, { width: widths[5] }]}>{line.cells.valorAnual}</Text>
        </View>
      ))}
      <Text style={{ marginTop: 8, fontSize: 9 }}>
        Correntes {eur(summary.subtotalCorrente)} · Opcionais com valor {eur(summary.subtotalOpcional)} · IVA {pct(summary.vatRate)} sobre correntes {eur(summary.vatCorrente)} · Total correntes com IVA {eur(summary.totalCorrenteComIva)} · Com opcionais e IVA {eur(summary.totalComOpcionais)}
      </Text>
    </View>
  );
}

function PdfBars({ summary }: { summary: Summary }) {
  const rows = [
    { label: "Mensal", value: summary.correnteByPeriod.mensal + summary.opcionalByPeriod.mensal },
    { label: "Trimestral", value: summary.correnteByPeriod.trimestral + summary.opcionalByPeriod.trimestral },
    { label: "Anual", value: summary.correnteByPeriod.anual + summary.opcionalByPeriod.anual },
    { label: "One Shot", value: summary.correnteByPeriod.one_shot + summary.opcionalByPeriod.one_shot },
  ];
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.h2}>Composição anual dos honorários</Text>
      {rows.map((row) => (
        <View key={row.label} style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          <Text style={{ width: 78, fontSize: 8 }}>{row.label}</Text>
          <View style={{ width: Math.max((row.value / max) * 260, 2), height: 8, backgroundColor: navy }} />
          <Text style={{ marginLeft: 6, fontSize: 8 }}>{eur(row.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function RuBars({ headcount }: { headcount: number | null }) {
  const max = RU_TIERS[RU_TIERS.length - 1]?.annual ?? 1;
  const active = RU_TIERS.find((tier) => headcount != null && headcount >= tier.min && (tier.max == null || headcount <= tier.max));
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={styles.h2}>Escalões · colaboradores sem o sócio-gerente: {headcount ?? 0}</Text>
      {RU_TIERS.map((tier) => (
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
  if (!src) return null;
  if (src.startsWith("/")) return path.join(process.cwd(), "public", src.replace(/^\//, ""));
  return src;
}
