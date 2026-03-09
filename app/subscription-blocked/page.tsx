"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "5511999999999";
const KIWIFY_URL_BASICO = process.env.NEXT_PUBLIC_KIWIFY_URL_BASICO ?? "#";
const KIWIFY_URL_PRO = process.env.NEXT_PUBLIC_KIWIFY_URL_PRO ?? "#";
const KIWIFY_URL_ENTERPRISE = process.env.NEXT_PUBLIC_KIWIFY_URL_ENTERPRISE ?? "#";

const REASON_MESSAGES: Record<string, string> = {
  trial_expired: "Seu período de teste de 15 dias encerrou.",
  overdue: "Identificamos um problema com seu pagamento.",
  canceled: "Sua assinatura foi cancelada.",
  blocked: "Acesso suspenso. Regularize sua assinatura para continuar.",
};

export default function SubscriptionBlockedPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason") ?? "blocked";
  const message = REASON_MESSAGES[reason] ?? REASON_MESSAGES.blocked;
  const isOverdue = reason === "overdue";

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold">Acesso suspenso</h1>
        <p className="text-slate-300">{message}</p>

        {isOverdue && (
          <div className="rounded-lg bg-amber-500/20 border border-amber-500/50 px-4 py-3 text-amber-200 text-sm">
            Você tem 3 dias de tolerância. Após esse prazo, o acesso será bloqueado. Regularize agora.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3 text-left">
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="font-semibold text-white">Básico</h3>
            <p className="mt-1 text-sm text-slate-400">Até 2 profissionais</p>
            <a
              href={KIWIFY_URL_BASICO}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block w-full rounded-lg bg-emerald-600 py-2 text-center text-sm font-medium text-white hover:bg-emerald-500"
            >
              Assinar
            </a>
          </div>
          <div className="rounded-xl border-2 border-indigo-500 bg-slate-800/50 p-4">
            <span className="rounded bg-indigo-600 px-2 py-0.5 text-xs font-medium">Popular</span>
            <h3 className="mt-1 font-semibold text-white">Pro</h3>
            <p className="mt-1 text-sm text-slate-400">Até 5 profissionais</p>
            <a
              href={KIWIFY_URL_PRO}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block w-full rounded-lg bg-indigo-600 py-2 text-center text-sm font-medium text-white hover:bg-indigo-500"
            >
              Assinar
            </a>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
            <h3 className="font-semibold text-white">Enterprise</h3>
            <p className="mt-1 text-sm text-slate-400">Sem limites</p>
            <a
              href={KIWIFY_URL_ENTERPRISE}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block w-full rounded-lg bg-slate-600 py-2 text-center text-sm font-medium text-white hover:bg-slate-500"
            >
              Assinar
            </a>
          </div>
        </div>

        <a
          href={`https://wa.me/${SUPPORT_WHATSAPP}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg border border-slate-600 bg-slate-800 px-6 py-3 text-sm font-medium text-white hover:bg-slate-700"
        >
          Falar com suporte
        </a>

        <p className="text-sm text-slate-500">
          <Link href="/login" className="underline hover:text-slate-400">
            Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  );
}
