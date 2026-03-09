"use client";

// UX ST-007 — Remarcar Agendamento
// Layout do modal:
// - Título no topo: "Remarcar Agendamento".
// - Texto com o nome do paciente em destaque (somente leitura).
// - Dois campos lado a lado: Data (date) e Horário (time).
// - Rodapé com botões "Cancelar" (outline) e "Confirmar" (primário em roxo suave).
// - Em sucesso: fecha o modal e recarrega a agenda através de onSuccess.

import { useState } from "react";

export type ReschedulableAppointment = {
  id: string;
  starts_at: string;
  patients?: {
    full_name?: string | null;
  } | null;
};

type Props = {
  appointment: ReschedulableAppointment;
  onClose: () => void;
  onSuccess: () => void;
};

const DEFAULT_DURATION_MINUTES = 30;

export default function RescheduleModal({
  appointment,
  onClose,
  onSuccess,
}: Props) {
  const starts = new Date(appointment.starts_at);
  const initialDate = starts.toISOString().slice(0, 10);
  const initialTime = `${String(starts.getHours()).padStart(2, "0")}:${String(
    starts.getMinutes(),
  ).padStart(2, "0")}`;

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
    const starts_at = start.toISOString();
    const ends_at = end.toISOString();

    setSubmitting(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at, ends_at }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Erro ao remarcar agendamento.");
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setError("Erro ao remarcar agendamento.");
    } finally {
      setSubmitting(false);
    }
  };

  const patientName = appointment.patients?.full_name || "Paciente";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2
            id="reschedule-title"
            className="text-lg font-semibold text-slate-900"
          >
            Remarcar Agendamento
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4">
          <div>
            <p className="text-sm text-slate-600">Paciente</p>
            <p className="text-sm font-medium text-slate-900">{patientName}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Horário
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

