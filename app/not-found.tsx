import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-slate-900">
      <span className="text-6xl" role="img" aria-hidden>🔍</span>
      <h1 className="mt-4 text-2xl font-bold text-slate-800">Página não encontrada</h1>
      <p className="mt-2 text-slate-600">A página que você procura não existe ou foi movida.</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Voltar
      </Link>
    </div>
  );
}
