"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro em ambiente de desenvolvimento
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-slate-900">
      <h1 className="text-xl font-semibold text-slate-800">Algo deu errado</h1>
      <p className="mt-2 text-sm text-slate-600">
        Ocorreu um erro inesperado. Tente recarregar a página.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Tentar novamente
      </button>
    </div>
  );
}
