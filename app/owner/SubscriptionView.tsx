"use client";

import { useEffect, useState } from "react";

type Status = {
  plan: string;
  plan_expires_at: string | null;
  active: boolean;
};

type Props = {
  clinicId: string;
};

const PLAN_LABELS: Record<string, string> = {
  trial: "Trial",
  basico: "Básico",
  pro: "Pro",
  enterprise: "Enterprise",
};

function planNameToKey(name: string): string {
  const n = (name ?? "").toLowerCase();
  if (n.includes("básico") || n === "basico") return "basico";
  if (n === "pro") return "pro";
  if (n.includes("enterprise")) return "enterprise";
  return n.replace(/\s+/g, "_");
}

const FELISMINO_SERVICES = [
  { id: "site", label: "Site Profissional" },
  { id: "redes", label: "Gestão de Redes Sociais" },
  { id: "trafego", label: "Tráfego Pago" },
] as const;

type PlanFromApi = { id: string; name: string; price_month: number; description?: string; max_providers?: number | null };

export default function SubscriptionView({ clinicId }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [plans, setPlans] = useState<PlanFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [felisminoModalOpen, setFelisminoModalOpen] = useState(false);
  const [felisminoSubmitting, setFelisminoSubmitting] = useState(false);
  const [felisminoSuccess, setFelisminoSuccess] = useState(false);
  const [clinicName, setClinicName] = useState("");
  const [contactForm, setContactForm] = useState({
    contact_name: "",
    whatsapp: "",
    service: "site",
  });

  useEffect(() => {
    fetch(`/api/billing?clinic_id=${encodeURIComponent(clinicId)}`)
      .then((res) => res.json())
      .then((data) => setStatus(data.subscription ?? null))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, [clinicId]);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((res) => res.json())
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => setPlans([]));
  }, []);

  const priceByPlanKey: Record<string, number> = {};
  plans.forEach((p) => {
    const key = planNameToKey(p.name);
    priceByPlanKey[key] = Number(p.price_month) || 0;
  });
  const planPriceLabel = (planKey: string): string => {
    if (planKey === "trial") return "Grátis por 30 dias";
    const num = priceByPlanKey[planKey];
    return num != null && !Number.isNaN(num) ? `R$ ${num.toLocaleString("pt-BR")}/mês` : "—";
  };

  const fetchClinicName = () => {
    fetch(`/api/owner/clinic?clinic_id=${encodeURIComponent(clinicId)}`)
      .then((res) => res.json())
      .then((data) => setClinicName(data?.clinic?.name ?? ""))
      .catch(() => setClinicName(""));
  };

  const handleUpgrade = async (plan: string) => {
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinic_id: clinicId, plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setCheckoutLoading(null);
    }
  };

  const openFelisminoModal = (serviceId?: string) => {
    setFelisminoSuccess(false);
    setContactForm((p) => ({ ...p, service: serviceId ?? p.service }));
    fetchClinicName();
    setFelisminoModalOpen(true);
  };

  const handleFelisminoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFelisminoSubmitting(true);
    try {
      const res = await fetch("/api/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          clinic_name: clinicName,
          contact_name: contactForm.contact_name.trim(),
          whatsapp: contactForm.whatsapp.trim(),
          service: contactForm.service,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert((data as { message?: string }).message ?? "Erro ao enviar.");
        return;
      }
      setFelisminoSuccess(true);
      setContactForm({ contact_name: "", whatsapp: "", service: "site" });
    } catch {
      alert("Erro ao enviar solicitação.");
    } finally {
      setFelisminoSubmitting(false);
    }
  };

  if (loading) return <p className="text-slate-500">Carregando...</p>;
  if (!status) return <p className="text-slate-500">Erro ao carregar assinatura.</p>;

  const plan = (status.plan ?? "trial") as string;
  const isActive = status.active !== false;
  const isTrial = plan === "trial";
  const expiresAt = status.plan_expires_at ? new Date(status.plan_expires_at) : null;
  const now = new Date();
  const trialDaysTotal = 30;
  const trialStart = expiresAt ? new Date(expiresAt.getTime() - trialDaysTotal * 24 * 60 * 60 * 1000) : now;
  const daysUsed = expiresAt ? Math.max(0, Math.floor((now.getTime() - trialStart.getTime()) / (24 * 60 * 60 * 1000))) : 0;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : (isTrial ? 30 : 0);
  const progressPct = isTrial && trialDaysTotal > 0 ? Math.min(100, (daysUsed / trialDaysTotal) * 100) : 0;

  const statusBadge =
    !isActive ? "Vencido" : isTrial ? "Trial" : "Ativo";
  const statusColor =
    !isActive ? "bg-rose-100 text-rose-800" : isTrial ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800";

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold text-slate-900">Assinatura</h2>

      {/* Seção 1 — Plano atual */}
      <div className="rounded-xl border-2 border-indigo-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">Plano atual</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{PLAN_LABELS[plan] ?? plan}</p>
            <p className="mt-1 text-xl text-indigo-600">{planPriceLabel(plan)}</p>
            {expiresAt && (
              <p className="mt-2 text-sm text-slate-500">
                Vencimento: {expiresAt.toLocaleDateString("pt-BR")}
              </p>
            )}
            {isTrial && daysLeft >= 0 && (
              <p className="mt-1 text-sm font-medium text-amber-700">{daysLeft} dias restantes</p>
            )}
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
              {statusBadge}
            </span>
          </div>
          {isTrial && trialDaysTotal > 0 && (
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Período trial</span>
                <span>{daysUsed} / {trialDaysTotal} dias</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Seção 2 — Comparativo de planos */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Comparativo de planos</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Trial */}
          <div className={`rounded-xl border-2 p-5 ${plan === "trial" ? "border-indigo-300 bg-indigo-50/50" : "border-slate-200 bg-white"}`}>
            <h4 className="font-semibold text-slate-900">Trial</h4>
            <p className="mt-1 text-lg font-bold text-slate-900">{planPriceLabel("trial")}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>• Até 1 profissional</li>
              <li>• Até 50 agendamentos/mês</li>
              <li>• WhatsApp básico</li>
              <li>• Suporte por email</li>
            </ul>
            {plan === "trial" && <span className="mt-3 inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">Atual</span>}
          </div>
          {/* Básico */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h4 className="font-semibold text-slate-900">Básico</h4>
            <p className="mt-1 text-lg font-bold text-slate-900">{planPriceLabel("basico")}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>• Até 2 profissionais</li>
              <li>• Agendamentos ilimitados</li>
              <li>• WhatsApp com IA</li>
              <li>• Lembretes automáticos</li>
              <li>• Suporte prioritário</li>
            </ul>
            <button
              type="button"
              disabled={!!checkoutLoading}
              onClick={() => handleUpgrade("basico")}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {checkoutLoading === "basico" ? "Redirecionando..." : "Assinar agora"}
            </button>
          </div>
          {/* Pro */}
          <div className="relative rounded-xl border-2 border-indigo-200 bg-white p-5">
            <span className="absolute -top-2 left-4 rounded bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">Mais popular</span>
            <h4 className="font-semibold text-slate-900">Pro</h4>
            <p className="mt-1 text-lg font-bold text-slate-900">{planPriceLabel("pro")}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>• Até 5 profissionais</li>
              <li>• Tudo do Básico</li>
              <li>• Campanhas WhatsApp</li>
              <li>• Relatórios avançados</li>
              <li>• Agendamento online público</li>
            </ul>
            <button
              type="button"
              disabled={!!checkoutLoading}
              onClick={() => handleUpgrade("pro")}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {checkoutLoading === "pro" ? "Redirecionando..." : "Assinar agora"}
            </button>
          </div>
          {/* Enterprise */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h4 className="font-semibold text-slate-900">Enterprise</h4>
            <p className="mt-1 text-lg font-bold text-slate-900">{planPriceLabel("enterprise")}</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>• Profissionais ilimitados</li>
              <li>• Tudo do Pro</li>
              <li>• IA personalizada</li>
              <li>• Suporte dedicado</li>
              <li>• Integração personalizada</li>
            </ul>
            <button
              type="button"
              onClick={() => window.open("https://wa.me/5511999999999", "_blank")}
              className="mt-4 w-full rounded-lg border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Falar com consultor
            </button>
          </div>
        </div>
      </div>

      {/* Seção 3 — Felismino Company */}
      <div className="overflow-hidden rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-lg">
        <h3 className="text-xl font-bold">🚀 Impulsione sua clínica com a Felismino Company</h3>
        <p className="mt-1 text-violet-100">Agência de marketing digital especializada em clínicas</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
            <p className="font-semibold">🌐 Site Profissional</p>
            <p className="mt-1 text-sm text-white/90">Site moderno e otimizado para sua clínica</p>
            <p className="text-sm text-white/80">Aparece no Google, aumenta credibilidade</p>
            <button
              type="button"
              onClick={() => openFelisminoModal("site")}
              className="mt-3 rounded bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-white/90"
            >
              Quero meu site
            </button>
          </div>
          <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
            <p className="font-semibold">📱 Gestão de Redes Sociais</p>
            <p className="mt-1 text-sm text-white/90">Instagram e Facebook da sua clínica gerenciados</p>
            <p className="text-sm text-white/80">Conteúdo profissional toda semana</p>
            <button
              type="button"
              onClick={() => openFelisminoModal("redes")}
              className="mt-3 rounded bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-white/90"
            >
              Quero saber mais
            </button>
          </div>
          <div className="rounded-lg bg-white/10 p-4 backdrop-blur">
            <p className="font-semibold">📈 Tráfego Pago</p>
            <p className="mt-1 text-sm text-white/90">Google Ads e Meta Ads para atrair pacientes</p>
            <p className="text-sm text-white/80">Mais agendamentos, mais receita</p>
            <button
              type="button"
              onClick={() => openFelisminoModal("trafego")}
              className="mt-3 rounded bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-white/90"
            >
              Quero mais pacientes
            </button>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-white/80">felismino.company | Fale conosco pelo WhatsApp</p>
      </div>

      {/* Modal Felismino */}
      {felisminoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setFelisminoModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900">Fale com a Felismino Company</h3>
            {felisminoSuccess ? (
              <p className="mt-4 text-slate-600">Solicitação enviada! Nossa equipe entrará em contato em até 24h 🎉</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">Nossa equipe vai entrar em contato para entender suas necessidades.</p>
                <form onSubmit={handleFelisminoSubmit} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Nome da clínica</label>
                    <input
                      type="text"
                      value={clinicName}
                      readOnly
                      className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Nome do responsável</label>
                    <input
                      type="text"
                      value={contactForm.contact_name}
                      onChange={(e) => setContactForm((p) => ({ ...p, contact_name: e.target.value }))}
                      required
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">WhatsApp</label>
                    <input
                      type="tel"
                      value={contactForm.whatsapp}
                      onChange={(e) => setContactForm((p) => ({ ...p, whatsapp: e.target.value }))}
                      required
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700">Serviço de interesse</label>
                    <select
                      value={contactForm.service}
                      onChange={(e) => setContactForm((p) => ({ ...p, service: e.target.value }))}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                      {FELISMINO_SERVICES.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFelisminoModalOpen(false)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={felisminoSubmitting}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {felisminoSubmitting ? "Enviando..." : "Enviar solicitação"}
                    </button>
                  </div>
                </form>
              </>
            )}
            {felisminoSuccess && (
              <button
                type="button"
                onClick={() => setFelisminoModalOpen(false)}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
