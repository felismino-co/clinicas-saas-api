"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import NewAppointmentModal from "./NewAppointmentModal";
import RescheduleModal from "./RescheduleModal";
import ConfirmDialog from "./ConfirmDialog";
import type { ReschedulableAppointment } from "./RescheduleModal";
import type { ToastType } from "./Toast";

export type Provider = { id: string; full_name: string | null };
export type Service = { id: string; name: string | null };

export type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  provider_id: string | null;
  service_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string | null;
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  patients?: {
    full_name?: string | null;
    phone?: string | null;
  } | null;
  providers?: {
    full_name?: string | null;
  } | null;
  services?: {
    name?: string | null;
  } | null;
};

export type CurrentUserForAudit = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  clinic_id: string | null;
};

type Props = {
  initialAppointments: Appointment[];
  clinicId: string;
  providers: Provider[];
  services: Service[];
  onAgendaUpdated?: () => void;
  showToast?: (message: string, type: ToastType) => void;
  currentUser?: CurrentUserForAudit | null;
  onNavigateToView?: (view: "patients" | "inbox") => void;
  highlightedAppointmentId?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  no_show: "Faltou",
  completed: "Concluído",
};

const STATUS_ROW_BG: Record<string, string> = {
  confirmed: "bg-green-50",
  scheduled: "bg-yellow-50",
  cancelled: "bg-red-50",
  no_show: "bg-slate-50",
  completed: "bg-blue-50",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  no_show: "bg-slate-100 text-slate-700 border-slate-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
};

async function updateStatus(id: string, status: string) {
  const res = await fetch(`/api/appointments/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const text = await res.text();
    // eslint-disable-next-line no-console
    console.error("Falha ao atualizar status do agendamento:", text);
    throw new Error("Falha ao atualizar agendamento");
  }

  const data = (await res.json()) as Appointment;
  return data;
}

function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 55%, 45%)`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  return name.slice(0, 2).toUpperCase() || "?";
}

function PatientAvatar({ name }: { name: string }) {
  const bg = nameToColor(name || "?");
  const initials = getInitials(name || "?");
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: bg }}
      title={name}
    >
      {initials}
    </div>
  );
}

export default function AgendaTable({
  initialAppointments,
  clinicId,
  providers: providersList,
  services,
  onAgendaUpdated,
  showToast,
  currentUser,
  onNavigateToView,
  highlightedAppointmentId,
}: Props) {
  const router = useRouter();
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [providerFilter, setProviderFilter] = useState<string | "all">("all");
  const [isPending, startTransition] = useTransition();
  const [showNewModal, setShowNewModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] =
    useState<ReschedulableAppointment | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowNewModal(false);
        setRescheduleTarget(null);
        setConfirmCancelId(null);
        return;
      }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setShowNewModal(true);
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        onNavigateToView?.("patients");
      }
      if (e.key === "i" || e.key === "I") {
        e.preventDefault();
        onNavigateToView?.("inbox");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNavigateToView]);

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const matchesStatus =
        statusFilter === "all" ? true : a.status === statusFilter;
      const providerName = a.providers?.full_name?.trim() || "Sem profissional";
      const matchesProvider =
        providerFilter === "all" ? true : providerName === providerFilter;
      return matchesStatus && matchesProvider;
    });
  }, [appointments, statusFilter, providerFilter]);

  const now = useMemo(() => new Date(), []);
  const sortedByStart = useMemo(() => [...filtered].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()), [filtered]);
  const nextAppointmentId = useMemo(() => {
    const future = sortedByStart.filter((a) => a.status !== "cancelled" && new Date(a.starts_at) >= now);
    return future[0]?.id ?? null;
  }, [sortedByStart, now]);
  const inProgressAppointmentId = useMemo(() => {
    return sortedByStart.find((a) => {
      if (a.status === "cancelled") return false;
      const start = new Date(a.starts_at).getTime();
      const end = new Date(a.ends_at).getTime();
      const t = now.getTime();
      return t >= start && t <= end;
    })?.id ?? null;
  }, [sortedByStart, now]);

  const providerNames = useMemo(() => {
    const names = new Set<string>();
    appointments.forEach((a) => {
      const n = a.providers?.full_name?.trim();
      if (n) names.add(n);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [appointments]);

  const handleChangeStatus = (id: string, status: string) => {
    startTransition(async () => {
      try {
        const updated = await updateStatus(id, status);
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: updated.status } : a)),
        );
        showToast?.(
          status === "cancelled" ? "Agendamento cancelado." : "Status atualizado.",
          "success",
        );
      } catch {
        showToast?.("Falha ao atualizar agendamento.", "error");
      }
    });
  };

  const handleConfirmCancel = () => {
    const id = confirmCancelId;
    setConfirmCancelId(null);
    if (id) handleChangeStatus(id, "cancelled");
  };

  return (
    <div className="space-y-4">
      {/* Filtros e Novo Agendamento */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
            title="Novo Agendamento (N). Atalhos: N Novo, P Pacientes, I Caixa de Entrada, ESC fechar modal"
          >
            Novo Agendamento
          </button>
          <div>
            <label className="block text-xs font-medium text-slate-500">
              Profissional
            </label>
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="mt-1 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Todos</option>
              {providerNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {providerNames.length === 0 && <option disabled>Sem profissionais</option>}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Todos</option>
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isPending && (
          <span className="text-xs text-slate-400">Atualizando...</span>
        )}
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-4 py-2">Horário</th>
              <th className="px-4 py-2">Paciente</th>
              <th className="hidden px-4 py-2 md:table-cell">Profissional</th>
              <th className="hidden px-4 py-2 md:table-cell">Serviço</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  {appointments.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <span className="text-6xl" role="img" aria-hidden>📅</span>
                      <p className="text-base font-medium text-slate-700">Nenhum agendamento para hoje</p>
                      <button
                        type="button"
                        onClick={() => setShowNewModal(true)}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                      >
                        Criar agendamento
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">Nenhum agendamento para os filtros selecionados.</span>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const start = new Date(a.starts_at);
                const end = new Date(a.ends_at);
                const datePart = start.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                });
                const timeLabel = `${datePart} • ${start.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })} - ${end.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`;
                const patientName = a.patients?.full_name || "Paciente sem nome";
                const providerName =
                  a.providers?.full_name || "Profissional não definido";
                const serviceName = a.services?.name || "Serviço não definido";
                const statusLabel = STATUS_LABELS[a.status] || a.status;
                const statusClasses =
                  STATUS_COLORS[a.status] ||
                  "bg-slate-100 text-slate-700 border-slate-200";
                const rowBg = STATUS_ROW_BG[a.status] || "";
                const isCancelled = a.status === "cancelled";
                const isHighlighted = highlightedAppointmentId === a.id;
                const isNow = inProgressAppointmentId === a.id;
                const isNext = nextAppointmentId === a.id;

                return (
                  <tr
                    key={a.id}
                    className={`border-t border-slate-100 ${rowBg} ${isHighlighted ? "ring-2 ring-inset ring-indigo-400" : ""} hover:opacity-95 ${isCancelled ? "opacity-80" : ""}`}
                    style={{
                      borderLeftWidth: isNow ? "4px" : isNext ? "4px" : 0,
                      borderLeftColor: isNow ? "rgb(34 197 94)" : isNext ? "rgb(59 130 246)" : "transparent",
                      borderLeftStyle: "solid",
                    }}
                  >
                    <td className={`px-4 py-3 align-top text-slate-800 ${isNow ? "animate-pulse" : ""}`} title={a.created_by_name ? `Criado por ${a.created_by_name}` : undefined}>
                      {timeLabel}
                      {a.created_by_name && (
                        <span className="block text-xs text-slate-400 mt-0.5" title={`Criado por ${a.created_by_name}`}>
                          por {a.created_by_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <PatientAvatar name={patientName} />
                        <div className="flex flex-col">
                          <span className={`font-medium text-slate-900 ${isCancelled ? "line-through" : ""}`}>
                            {patientName}
                          </span>
                        {a.patients?.phone && (
                          <span className="text-xs text-slate-500">
                            {a.patients.phone}
                          </span>
                        )}
                        {a.notes && (
                          <span
                            className="mt-1 text-xs text-slate-500"
                            title={a.notes}
                          >
                            📝 {a.notes.length > 40 ? `${a.notes.slice(0, 40)}…` : a.notes}
                          </span>
                        )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 hidden md:table-cell">
                      {providerName}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700 hidden md:table-cell">
                      {serviceName}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClasses}`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex justify-end gap-1 md:gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(a.id, "confirmed")}
                          className="rounded-full border border-emerald-200 bg-emerald-50 p-1.5 md:px-3 md:py-1 font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={a.status === "confirmed"}
                          title="Confirmar"
                        >
                          <span className="md:hidden">✓</span>
                          <span className="hidden md:inline">Confirmar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(a.id, "no_show")}
                          className="rounded-full border border-slate-200 bg-slate-50 p-1.5 md:px-3 md:py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={a.status === "no_show"}
                          title="No-show"
                        >
                          <span className="md:hidden">N</span>
                          <span className="hidden md:inline">No-show</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(a.id)}
                          className="rounded-full border border-rose-200 bg-rose-50 p-1.5 md:px-3 md:py-1 font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={a.status === "cancelled"}
                          title="Cancelar"
                        >
                          <span className="md:hidden">✕</span>
                          <span className="hidden md:inline">Cancelar</span>
                        </button>
                        {a.status !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() => setRescheduleTarget(a)}
                            className="rounded-full border border-violet-200 bg-violet-50 p-1.5 md:px-3 md:py-1 font-medium text-violet-700 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Remarcar"
                          >
                            <span className="md:hidden">↻</span>
                            <span className="hidden md:inline">Remarcar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {confirmCancelId && (
        <ConfirmDialog
          message="Deseja realmente cancelar este agendamento?"
          confirmLabel="Cancelar agendamento"
          variant="danger"
          onConfirm={handleConfirmCancel}
          onCancel={() => setConfirmCancelId(null)}
        />
      )}
      {showNewModal && (
        <NewAppointmentModal
          clinicId={clinicId}
          providers={providersList}
          services={services}
          onClose={() => setShowNewModal(false)}
          onSuccess={() => {
            onAgendaUpdated?.();
            showToast?.("Agendamento criado.", "success");
            router.refresh();
          }}
          showToast={showToast}
        />
      )}
      {rescheduleTarget && (
        <RescheduleModal
          appointment={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={() => {
            setRescheduleTarget(null);
            onAgendaUpdated?.();
            showToast?.("Agendamento remarcado.", "success");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

