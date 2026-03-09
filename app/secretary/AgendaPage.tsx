"use client";

// Navegação principal do Painel da Secretária entre:
// - Agenda do dia (tabela de agendamentos)
// - Lista de Pacientes
// O estado de navegação fica aqui para que a sidebar controle qual view está ativa.

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import AgendaTable, {
  Appointment,
  Provider,
  Service,
} from "./AgendaTable";
import PatientsPage from "./PatientsPage";
import InboxPage from "./InboxPage";
import ReportsView from "./ReportsView";
import NotificationBell from "./NotificationBell";
import Toast, { type ToastType } from "./Toast";
import { useCurrentUser } from "../hooks/useCurrentUser";
import OnboardingTour from "../components/OnboardingTour";

type View = "agenda" | "patients" | "inbox" | "reports";

type AgendaApiResponse = {
  appointments: Appointment[];
  date: string;
  providers: Provider[];
  services: Service[];
};

const FALLBACK_CLINIC_ID_ADMIN = "5b6be922-273f-436e-9eb0-515767ec7817";

export default function AgendaPage() {
  const router = useRouter();
  const { user: currentUser, loading: loadingUser, error: userError } = useCurrentUser();
  const rawRole = currentUser?.role ?? "";
  const isAdmin = rawRole === "admin" || rawRole === "admin_global";
  const effectiveClinicId =
    isAdmin && !currentUser?.clinic_id
      ? FALLBACK_CLINIC_ID_ADMIN
      : (currentUser?.clinic_id ?? null);
  const isAdminMode = isAdmin && !currentUser?.clinic_id;
  const clinicId = effectiveClinicId;

  const [activeView, setActiveView] = useState<View>("agenda");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [highlightedAppointmentId, setHighlightedAppointmentId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("tour_completed_secretary") !== "true") setShowTour(true);
  }, []);

  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return [];
    const q = globalSearch.trim().toLowerCase();
    return appointments
      .filter(
        (a) =>
          (a.patients?.full_name ?? "").toLowerCase().includes(q) ||
          (a.patients?.phone ?? "").includes(q) ||
          (a.services?.name ?? "").toLowerCase().includes(q) ||
          (a.providers?.full_name ?? "").toLowerCase().includes(q) ||
          (a.notes ?? "").toLowerCase().includes(q),
      )
      .slice(0, 10);
  }, [appointments, globalSearch]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const showToast = (message: string, type: ToastType) => setToast({ message, type });

  useEffect(() => {
    if (!clinicId) return;
    let cancelled = false;
    fetch(`/api/owner/whatsapp-status?clinic_id=${encodeURIComponent(clinicId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setWhatsappConnected(data?.connected === true);
      })
      .catch(() => {
        if (!cancelled) setWhatsappConnected(false);
      });
    return () => { cancelled = true; };
  }, [clinicId]);

  const fetchAgenda = async (dateParam?: string) => {
    if (!clinicId) return;
    const d = dateParam ?? selectedDate;
    setLoadingAgenda(true);
    setAgendaError(null);
    try {
      const params = new URLSearchParams({ clinic_id: clinicId, date: d });
      const res = await fetch(`/api/appointments?${params.toString()}`);
      const data = (await res.json()) as AgendaApiResponse | { message?: string };
      if (!res.ok) {
        setAgendaError(
          (data as any)?.message ?? "Erro ao carregar agenda do dia.",
        );
        setAppointments([]);
        setProviders([]);
        setServices([]);
        setDate(null);
        return;
      }
      setAppointments((data as AgendaApiResponse).appointments ?? []);
      setProviders((data as AgendaApiResponse).providers ?? []);
      setServices((data as AgendaApiResponse).services ?? []);
      setDate((data as AgendaApiResponse).date ?? null);
    } catch {
      setAgendaError("Erro ao carregar agenda do dia.");
      setAppointments([]);
      setProviders([]);
      setServices([]);
      setDate(null);
    } finally {
      setLoadingAgenda(false);
    }
  };

  useEffect(() => {
    if (activeView === "agenda" && clinicId) {
      fetchAgenda(selectedDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, selectedDate, clinicId]);

  const isAgenda = activeView === "agenda";
  const isPatients = activeView === "patients";
  const isInbox = activeView === "inbox";
  const isReports = activeView === "reports";

  if (loadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center text-slate-600">Carregando...</div>
      </div>
    );
  }
  if (userError || !effectiveClinicId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center text-amber-800 max-w-md">
          <p className="font-medium">Sem acesso à clínica</p>
          <p className="mt-2 text-sm">
            Sua conta não está vinculada a uma clínica. Entre em contato com o administrador ou configure sua clínica no painel do dono.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/owner")}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Painel do Dono
            </button>
            <button
              type="button"
              onClick={() => router.push("/profile")}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-50"
            >
              Meu perfil
            </button>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const safeClinicId: string = clinicId as string;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow md:hidden"
        aria-label="Abrir menu"
      >
        <span className="text-lg">{sidebarOpen ? "✕" : "☰"}</span>
      </button>
      {/* Sidebar */}
      <>
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden
          />
        )}
      <aside className={`flex h-screen w-64 flex-col border-r border-slate-200 bg-white ${sidebarOpen ? "fixed inset-y-0 left-0 z-40" : "hidden md:flex"}`}>
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-200">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
            SC
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Painel da Secretária</span>
            <span className="text-xs text-slate-500">Clínica Multi-Atendimento</span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4 text-sm">
          <button
            type="button"
            onClick={() => { setActiveView("agenda"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              isAgenda
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isAgenda ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            Agenda
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("patients"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              isPatients
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isPatients ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            Pacientes
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("inbox"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              isInbox
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isInbox ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            Caixa de Entrada
          </button>
          <button
            type="button"
            onClick={() => { setActiveView("reports"); setSidebarOpen(false); }}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-medium ${
              isReports
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isReports ? "bg-emerald-500" : "bg-slate-300"
              }`}
            />
            Relatórios
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
            onClick={() => router.push("/owner")}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Painel do Dono
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
          <div className="px-1 text-xs text-slate-500">
            v0.1 • MVP Atendimento
          </div>
        </div>
      </aside>
      </>

      {/* Main content */}
      {isAgenda ? (
        <main className="flex-1 overflow-y-auto">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Agenda do dia
              </h1>
              <p className="text-sm text-slate-500">
                {date
                  ? new Date(date).toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "Carregando data..."}
              </p>
              {!loadingAgenda && !agendaError && date && (
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium">{appointments.length}</span> agendamentos
                  {" • "}
                  <span className="font-medium">{appointments.filter((a) => a.status === "confirmed").length}</span> confirmados
                  {" • "}
                  <span className="font-medium">{appointments.filter((a) => a.status === "scheduled").length}</span> pendentes
                  {" • "}
                  <span className="font-medium">{appointments.filter((a) => a.status === "cancelled").length}</span> cancelados
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {isAdminMode && (
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-800">
                  Modo Admin
                </span>
              )}
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Buscar paciente, agendamento... (/)"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  className="w-56 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                {searchResults.length > 0 && (
                  <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {searchResults.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => {
                          setHighlightedAppointmentId(a.id);
                          setGlobalSearch("");
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-900">{a.patients?.full_name || "Paciente"}</span>
                        <span className="ml-1 text-slate-500">
                          {a.services?.name} · {new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="flex items-center gap-1.5 text-sm text-slate-600" title={whatsappConnected === true ? "WhatsApp conectado" : whatsappConnected === false ? "WhatsApp desconectado" : "Verificando..."}>
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                    whatsappConnected === true
                      ? "bg-emerald-500 animate-pulse"
                      : whatsappConnected === false
                        ? "bg-red-500"
                        : "bg-slate-400"
                  }`}
                />
                {whatsappConnected === true ? "WhatsApp" : whatsappConnected === false ? "WhatsApp" : "..."}
              </span>
              <NotificationBell clinicId={safeClinicId} />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">Data:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 1);
                    setSelectedDate(d.toISOString().slice(0, 10));
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ontem
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDate(new Date().toISOString().slice(0, 10))
                  }
                  className="rounded-md border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    setSelectedDate(d.toISOString().slice(0, 10));
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Amanhã
                </button>
              </div>
            </div>
          </header>
          <section className="px-8 py-6">
            {loadingAgenda ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Horário</th>
                      <th className="px-4 py-2">Paciente</th>
                      <th className="px-4 py-2">Profissional</th>
                      <th className="px-4 py-2">Serviço</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded bg-slate-200" /></td>
                        <td className="px-4 py-3 text-right"><div className="ml-auto h-6 w-24 animate-pulse rounded bg-slate-200" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : agendaError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm text-rose-700">
                {agendaError}
              </div>
            ) : (
              <AgendaTable
                initialAppointments={appointments}
                clinicId={safeClinicId}
                providers={providers}
                services={services}
                onAgendaUpdated={() => fetchAgenda(selectedDate)}
                showToast={showToast}
                currentUser={currentUser}
                onNavigateToView={setActiveView}
                highlightedAppointmentId={highlightedAppointmentId}
              />
            )}
          </section>
        </main>
      ) : isInbox ? (
        <InboxPage clinicId={safeClinicId} showToast={showToast} />
      ) : isReports ? (
        <ReportsView clinicId={safeClinicId} />
      ) : (
        <PatientsPage clinicId={safeClinicId} showToast={showToast} />
      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      {showTour && (
        <OnboardingTour
          storageKey="tour_completed_secretary"
          steps={[
            { title: "Bem-vindo ao painel! 👋", description: "Aqui você gerencia todos os agendamentos da clínica." },
            { title: "Filtros", description: "Use os filtros para encontrar agendamentos por profissional ou status." },
            { title: "Novo Agendamento", description: "Clique em Novo Agendamento para marcar uma consulta." },
            { title: "Pacientes", description: "Acesse Pacientes para ver e cadastrar pacientes." },
            { title: "Caixa de Entrada", description: "A Caixa de Entrada mostra suas mensagens do WhatsApp." },
            { title: "Tudo pronto! 🎉", description: "Bom trabalho!" },
          ]}
          onComplete={() => setShowTour(false)}
        />
      )}
    </div>
  );
}

