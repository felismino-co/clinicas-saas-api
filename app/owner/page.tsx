"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardView from "./DashboardView";
import ProvidersView from "./ProvidersView";
import ServicesView from "./ServicesView";
import SettingsView from "./SettingsView";
import CampaignsView from "./CampaignsView";
import AISettingsView from "./AISettingsView";
import SubscriptionView from "./SubscriptionView";
import StaffView from "./StaffView";
import AuditView from "./AuditView";
import CommissionsView from "./CommissionsView";
import BotAnalyticsView from "./BotAnalyticsView";
import ContactsView from "./ContactsView";
import Toast, { type ToastType } from "../secretary/Toast";
import { useCurrentUser } from "../hooks/useCurrentUser";
import OnboardingTour from "../components/OnboardingTour";

type View = "dashboard" | "providers" | "services" | "settings" | "campaigns" | "ai-settings" | "subscription" | "staff" | "audit" | "commissions" | "bot-analytics" | "contacts";

const FALLBACK_CLINIC_ID_ADMIN = "5b6be922-273f-436e-9eb0-515767ec7817";

export default function OwnerPage() {
  const router = useRouter();
  const { user: currentUser, loading: loadingUser, error: userError } = useCurrentUser();
  const rawRole = currentUser?.role ?? "";
  const isAdmin = rawRole === "admin" || rawRole === "admin_global";
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [impersonateClinicId, setImpersonateClinicId] = useState<string | null>(null);
  const [impersonateClinicName, setImpersonateClinicName] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    subscription_status?: string;
    plan?: string;
    plan_expires_at?: string | null;
    overdue_since?: string | null;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("tour_completed_owner") !== "true") setShowTour(true);
  }, []);

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    const id = sessionStorage.getItem("impersonate_clinic_id");
    const name = sessionStorage.getItem("impersonate_clinic_name");
    setImpersonateClinicId(id);
    setImpersonateClinicName(name);
  }, []);

  const effectiveClinicId =
    impersonateClinicId ||
    (isAdmin && !currentUser?.clinic_id ? FALLBACK_CLINIC_ID_ADMIN : (currentUser?.clinic_id ?? null));
  const clinicId = effectiveClinicId;
  const isAdminMode = isAdmin && !currentUser?.clinic_id && !impersonateClinicId;
  const isImpersonating = !!impersonateClinicId;
  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  useEffect(() => {
    if (isAdmin || !clinicId) return;
    fetch(`/api/billing?clinic_id=${encodeURIComponent(clinicId)}`)
      .then((res) => res.json())
      .then((data) => setSubscriptionStatus(data?.subscription ?? null))
      .catch(() => setSubscriptionStatus(null));
  }, [isAdmin, clinicId]);

  const is = (v: View) => activeView === v;

  if (loadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center text-slate-600">Carregando...</div>
      </div>
    );
  }
  if (userError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-700">
          <p className="font-medium">Sem acesso à clínica</p>
          <button type="button" onClick={() => router.push("/login")} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
            Ir para login
          </button>
        </div>
      </div>
    );
  }
  if (!effectiveClinicId && (currentUser?.role === "owner" || currentUser?.role === "clinic_owner")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-amber-800 max-w-md">
          <p className="font-medium">Configure sua clínica</p>
          <p className="mt-2 text-sm text-amber-700">Complete o cadastro da sua clínica para acessar o painel.</p>
          <button type="button" onClick={() => router.push("/onboarding")} className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
            Ir para onboarding
          </button>
        </div>
      </div>
    );
  }
  if (!effectiveClinicId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-700">
          <p className="font-medium">Sem acesso à clínica</p>
          <button type="button" onClick={() => router.push("/login")} className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
            Ir para login
          </button>
        </div>
      </div>
    );
  }

  const safeClinicId: string = clinicId as string;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {isImpersonating && (
        <div className="flex items-center justify-between gap-4 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
          <span>Você está visualizando como: {impersonateClinicName ?? "Clínica"}</span>
          <button
            type="button"
            onClick={() => {
              if (typeof sessionStorage !== "undefined") {
                sessionStorage.removeItem("impersonate_clinic_id");
                sessionStorage.removeItem("impersonate_clinic_name");
              }
              window.location.href = "/admin";
            }}
            className="rounded bg-amber-600 px-3 py-1 text-white hover:bg-amber-700"
          >
            Sair da visualização
          </button>
        </div>
      )}
      {!isAdmin && subscriptionStatus?.subscription_status === "overdue" && (() => {
        const overdueSince = subscriptionStatus.overdue_since;
        const daysOverdue = overdueSince ? Math.floor((Date.now() - new Date(overdueSince).getTime()) / (24 * 60 * 60 * 1000)) : 0;
        const daysUntilBlock = Math.max(0, 3 - daysOverdue);
        return (
          <div className="flex items-center justify-between gap-4 bg-amber-500 px-4 py-2.5 text-sm font-medium text-amber-950">
            <span>⚠️ Pagamento pendente. Sua clínica será suspensa em {daysUntilBlock} dia(s). Regularize agora →</span>
            <button type="button" onClick={() => setActiveView("subscription")} className="rounded bg-amber-600 px-3 py-1 text-white hover:bg-amber-700 shrink-0">
              Assinatura
            </button>
          </div>
        );
      })()}
      {!isAdmin && subscriptionStatus?.subscription_status === "trial" && subscriptionStatus?.plan_expires_at && (() => {
        const expiresAt = new Date(subscriptionStatus.plan_expires_at);
        const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
        return (
          <div className="flex items-center justify-between gap-4 bg-blue-500 px-4 py-2.5 text-sm font-medium text-blue-950">
            <span>🎯 Trial: {daysLeft} dia(s) restantes. Assine agora para não perder o acesso →</span>
            <button type="button" onClick={() => setActiveView("subscription")} className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 shrink-0">
              Assinatura
            </button>
          </div>
        );
      })()}
      <div className="flex flex-1">
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow md:hidden"
        aria-label="Abrir menu"
      >
        <span className="text-lg">{sidebarOpen ? "✕" : "☰"}</span>
      </button>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 md:hidden" onClick={() => setSidebarOpen(false)} aria-hidden />
      )}
      <aside className={`flex h-screen w-64 flex-col border-r border-slate-200 bg-white ${sidebarOpen ? "fixed inset-y-0 left-0 z-40" : "hidden md:flex"}`}>
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
            D
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Dono da Clínica</span>
            <span className="text-xs text-slate-500">Painel administrativo</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4 text-sm">
          <button
            type="button"
            onClick={() => { setActiveView("dashboard"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("dashboard")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("dashboard") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("providers"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("providers")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("providers") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Profissionais
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("services"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("services")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("services") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Serviços
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("settings"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("settings")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("settings") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Configurações
          </button>
          {/* Campanhas — oculto da navegação
          <button
            type="button"
            onClick={() => { setActiveView("campaigns"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("campaigns")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("campaigns") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Campanhas
          </button>
          */}
          <button
            type="button"
            onClick={() => { setActiveView("ai-settings"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("ai-settings")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("ai-settings") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Configurações IA
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("subscription"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("subscription")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("subscription") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Assinatura
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("staff"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("staff")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("staff") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Equipe
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("audit"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("audit")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("audit") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Auditoria
          </button>
          {/* Comissões — oculto da navegação
          <button
            type="button"
            onClick={() => { setActiveView("commissions"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("commissions")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("commissions") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Comissões
          </button>
          */}
          <button
            type="button"
            onClick={() => { setActiveView("bot-analytics"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("bot-analytics")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("bot-analytics") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            Analytics Bot
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("contacts"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              is("contacts")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                is("contacts") ? "bg-indigo-500" : "bg-slate-300"
              }`}
            />
            👥 Contatos
          </button>
        </nav>
        <div className="border-t border-slate-200 px-3 py-3 space-y-1">
          <button
            type="button"
            onClick={() => router.push("/profile")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Meu perfil
          </button>
          <button
            type="button"
            onClick={() => router.push("/secretary")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Painel Secretária
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Painel Admin
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.push("/login");
              router.refresh();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <header className="border-b border-slate-200 bg-white px-8 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900">
              {activeView === "dashboard" && "Dashboard"}
              {activeView === "providers" && "Profissionais"}
              {activeView === "services" && "Serviços"}
              {activeView === "settings" && "Configurações"}
              {/* activeView === "campaigns" && "Campanhas" — oculto */}
              {activeView === "ai-settings" && "Configurações IA"}
              {activeView === "subscription" && "Assinatura"}
              {activeView === "staff" && "Equipe"}
              {activeView === "audit" && "Auditoria"}
              {/* activeView === "commissions" && "Comissões" — oculto */}
              {activeView === "bot-analytics" && "Analytics Bot"}
            </h1>
            {isAdminMode && (
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-800">
                Modo Admin
              </span>
            )}
          </div>
        </header>
        <section className="p-8">
          {activeView === "dashboard" && (
            <DashboardView clinicId={safeClinicId} />
          )}
          {activeView === "providers" && (
            <ProvidersView clinicId={safeClinicId} showToast={showToast} />
          )}
          {activeView === "services" && (
            <ServicesView clinicId={safeClinicId} showToast={showToast} />
          )}
          {activeView === "settings" && (
            <SettingsView clinicId={safeClinicId} />
          )}
          {/* Campanhas — oculto
          {activeView === "campaigns" && (
            <CampaignsView clinicId={safeClinicId} showToast={showToast} />
          )}
          */}
          {activeView === "ai-settings" && (
            <AISettingsView clinicId={safeClinicId} />
          )}
          {activeView === "subscription" && (
            <SubscriptionView clinicId={safeClinicId} />
          )}
          {activeView === "staff" && (
            <StaffView clinicId={safeClinicId} showToast={showToast} />
          )}
          {activeView === "audit" && (
            <AuditView clinicId={safeClinicId} />
          )}
          {/* Comissões — oculto
          {activeView === "commissions" && (
            <CommissionsView clinicId={safeClinicId} showToast={showToast} />
          )}
          */}
          {activeView === "bot-analytics" && (
            <BotAnalyticsView clinicId={safeClinicId} />
          )}
          {activeView === "contacts" && (
            <ContactsView clinicId={safeClinicId} showToast={showToast} />
          )}
        </section>
      </main>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      {showTour && (
        <OnboardingTour
          storageKey="tour_completed_owner"
          steps={[
            { title: "Bem-vindo ao Painel do Dono! 👋", description: "Aqui você tem visão completa da clínica." },
            { title: "Dashboard", description: "O Dashboard mostra suas métricas em tempo real." },
            { title: "Profissionais", description: "Em Profissionais você cadastra e gerencia sua equipe médica." },
            { title: "Serviços", description: "Configure os Serviços oferecidos pela clínica." },
            { title: "Assistente de IA", description: "O assistente de IA atende seus pacientes automaticamente." },
            { title: "Comissões e Relatórios", description: "Acompanhe Comissões e Relatórios da sua equipe." },
            { title: "Tudo pronto! 🎉", description: "Aproveite o painel!" },
          ]}
          onComplete={() => setShowTour(false)}
        />
      )}
      </div>
    </div>
  );
}