"use client";

import { useEffect, useState } from "react";

type AuditLog = {
  id: string;
  user_name: string | null;
  user_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_COLORS: Record<string, string> = {
  APPOINTMENT_CREATED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  APPOINTMENT_CONFIRMED: "bg-sky-100 text-sky-800 border-sky-200",
  APPOINTMENT_CANCELLED: "bg-rose-100 text-rose-800 border-rose-200",
  APPOINTMENT_RESCHEDULED: "bg-amber-100 text-amber-800 border-amber-200",
  APPOINTMENT_NO_SHOW: "bg-slate-100 text-slate-700 border-slate-200",
  PATIENT_CREATED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PATIENT_UPDATED: "bg-sky-100 text-sky-800 border-sky-200",
  PATIENT_BLOCKED: "bg-rose-100 text-rose-800 border-rose-200",
  MESSAGE_SENT: "bg-violet-100 text-violet-800 border-violet-200",
  AI_PAUSED: "bg-amber-100 text-amber-800 border-amber-200",
  AI_ACTIVATED: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const ACTION_LABELS: Record<string, string> = {
  APPOINTMENT_CREATED: "Agendamento criado",
  APPOINTMENT_CONFIRMED: "Confirmado",
  APPOINTMENT_CANCELLED: "Cancelado",
  APPOINTMENT_RESCHEDULED: "Remarcado",
  APPOINTMENT_NO_SHOW: "Faltou",
  PATIENT_CREATED: "Paciente criado",
  PATIENT_UPDATED: "Paciente atualizado",
  PATIENT_BLOCKED: "Paciente bloqueado",
  MESSAGE_SENT: "Mensagem enviada",
  AI_PAUSED: "IA pausada",
  AI_ACTIVATED: "IA ativada",
};

type AuditViewProps = { clinicId: string };

export default function AuditView({ clinicId }: AuditViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("week");

  const fetchLogs = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      clinic_id: clinicId,
      page: String(page),
      period: filterPeriod,
    });
    if (filterUser) params.set("user_id", filterUser);
    if (filterAction) params.set("action", filterAction);
    try {
      const res = await fetch(`/api/owner/audit?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clinicId) return;
    fetchLogs();
  }, [clinicId, page, filterPeriod, filterUser, filterAction]);

  const detailsStr = (d: Record<string, unknown> | null) => {
    if (!d) return "—";
    return Object.entries(d)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join(" • ");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500">Período</label>
          <select
            value={filterPeriod}
            onChange={(e) => { setFilterPeriod(e.target.value); setPage(1); }}
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="today">Hoje</option>
            <option value="week">Última semana</option>
            <option value="month">Último mês</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500">Ação</label>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas</option>
            {Object.entries(ACTION_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fetchLogs()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Carregando...</div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-4 py-3">Data/hora</th>
                  <th className="px-4 py-3">Funcionário</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Nenhum registro no período.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900">{log.user_name ?? "—"}</span>
                        {log.user_email && (
                          <span className="block text-xs text-slate-500">{log.user_email}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                            ACTION_COLORS[log.action] ?? "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={detailsStr(log.details)}>
                        {detailsStr(log.details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>
                Página {page} de {totalPages} ({total} registros)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
