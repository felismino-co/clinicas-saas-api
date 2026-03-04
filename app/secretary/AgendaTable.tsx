"use client";

import { useMemo, useState, useTransition } from "react";

type Appointment = {
  id: string;
  clinic_id: string;
  patient_id: string;
  provider_id: string | null;
  service_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  notes?: string | null;
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

type Props = {
  initialAppointments: Appointment[];
  clinicId: string;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  no_show: "Faltou",
  completed: "Concluído",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-800 border-rose-200",
  no_show: "bg-slate-100 text-slate-700 border-slate-200",
  completed: "bg-sky-100 text-sky-800 border-sky-200",
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

export default function AgendaTable({ initialAppointments }: Props) {
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);
  const [statusFilter, setStatusFilter] = useState<string | "all">("all");
  const [providerFilter, setProviderFilter] = useState<string | "all">("all");
  const [isPending, startTransition] = useTransition();

  const providers = useMemo(() => {
    const names = new Set<string>();
    appointments.forEach((a) => {
      const n = a.providers?.full_name?.trim();
      if (n) names.add(n);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [appointments]);

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

  const handleChangeStatus = (id: string, status: string) => {
    startTransition(async () => {
      try {
        const updated = await updateStatus(id, status);
        setAppointments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status: updated.status } : a)),
        );
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        // futura: mostrar toast de erro
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Filtros */} 
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
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
              {providers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {providers.length === 0 && <option disabled>Sem profissionais</option>}
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
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  Nenhum agendamento para os filtros selecionados.
                </td>
              </tr>
            ) : (
              filtered.map((a) => {
                const start = new Date(a.starts_at);
                const end = new Date(a.ends_at);
                const timeLabel = `${start.toLocaleTimeString("pt-BR", {
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

                return (
                  <tr
                    key={a.id}
                    className="border-t border-slate-100 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3 align-top text-slate-800">
                      {timeLabel}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                          {patientName}
                        </span>
                        {a.patients?.phone && (
                          <span className="text-xs text-slate-500">
                            {a.patients.phone}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      {providerName}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
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
                      <div className="flex justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(a.id, "confirmed")}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={a.status === "confirmed"}
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(a.id, "no_show")}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={a.status === "no_show"}
                        >
                          No-show
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(a.id, "cancelled")}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 font-medium text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={a.status === "cancelled"}
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

