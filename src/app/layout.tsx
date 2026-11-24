import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KS Consultores · Avenças e propostas",
    template: "%s · KS Consultores",
  },
  description: "Cálculo de avenças e propostas de prestação de serviços para 2027.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="min-h-screen font-sans">
        <header className="no-print border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-3">
              <img src="/brand/ks-logo.png" alt="KS Consultores" className="h-10 w-auto" />
            </Link>
            <nav className="flex gap-4 text-sm text-navy">
              <Link href="/" className="hover:underline">Clientes</Link>
              <Link href="/tabela" className="hover:underline">Tabela de preços</Link>
            </nav>
          </div>
          <div className="h-1 bg-navy" />
          <div className="h-0.5 bg-[#8d2f39]" />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
