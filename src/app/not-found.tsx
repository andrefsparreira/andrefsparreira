import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="font-serif text-3xl text-navy">Página não encontrada</h1>
      <Link href="/" className="mt-4 inline-block text-sm text-navy underline">Voltar aos clientes</Link>
    </div>
  );
}