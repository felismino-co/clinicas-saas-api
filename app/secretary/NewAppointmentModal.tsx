"use client";

import { useCallback, useState } from "react";

type Patient = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email?: string | null;
};

type Provider = { id: string; full_name: string | null };
type Service = { id: string; name: string | null };

type Props = {
  clinicId: string;
  providers: Provider[];
  services: Service[];
  onClose: () => void;
  onSuccess: () => void;
  showToast?: (message: string, type: "success" | "error" | "info") => void;
};

const DEFAULT_DURATION_MINUTES = 30;

export default function NewAppointmentModal({
  clinicId,
  providers,
  services,
  onClose,
  onSuccess,
  showToast,
}: Props) {
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searching, setSearching] = useState(false);
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [time, setTime] = useState("09:00");
  const [providerId, setProviderId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPatients = useCallback(async () => {
    const q = patientSearch.trim();
    if (!q) {
      setPatientResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patients/search?clinic_id=${encodeURIComponent(clinicId)}&q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setPatientResults([]);
        setError(data?.message ?? "Erro ao buscar pacientes.");
        return;
      }
      setPatientResults(data.patients ?? []);
    } catch {
      setPatientResults([]);
      setError("Erro ao buscar pacientes.");
    } finally {
      setSearching(false);
    }
  }, [clinicId, patientSearch]);

  const handleSelectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setPatientSearch(p.full_name || p.phone || "");
    setPatientResults([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      setError("Selecione um paciente.");
      return;
    }
    // Interpretar data/hora no fuso local do usuário e converter para ISO UTC
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + DEFAULT_DURATION_MINUTES * 60 * 1000);
    const starts_at = start.toISOString();
    const ends_at = end.toISOString();

    const body = {
      clinic_id: clinicId,
      patient_id: selectedPatient.id,
      provider_id: providerId || null,
      service_id: serviceId || null,
      starts_at,
      ends_at,
      source: "manual" as const,
      notes: notes.trim() || null,
    };

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (data && typeof data.message === "string" && data.message) ||
          (data && typeof data.error === "string" && data.error) ||
          "Erro ao criar agendamento.";
        setError(msg);
        showToast?.(msg, "error");
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar agendamento.";
      setError(msg);
      showToast?.(msg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-slate-900"
          >
            Novo Agendamento
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4">
          {/* Busca de paciente */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Paciente
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setSelectedPatient(null);
                }}
                onBlur={() => setTimeout(searchPatients, 200)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchPatients())}
                placeholder="Nome ou telefone"
                className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={searchPatients}
                disabled={searching}
                className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                {searching ? "..." : "Buscar"}
              </button>
            </div>
            {patientResults.length > 0 && (
              <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-sm">
                {patientResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectPatient(p)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                    >
                      <span className="font-medium text-slate-900">
                        {p.full_name || "Sem nome"}
                      </span>
                      {p.phone && (
                        <span className="ml-2 text-slate-500">{p.phone}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {selectedPatient && (
              <p className="mt-1 text-xs text-emerald-600">
                Selecionado: {selectedPatient.full_name || selectedPatient.phone}
              </p>
            )}
          </div>

          {/* Data e horário */}
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
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Profissional */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Profissional
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Selecione</option>
              {providers.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.full_name || "Sem nome"}
                </option>
              ))}
            </select>
          </div>

          {/* Serviço */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Serviço
            </label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">Selecione</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || "Sem nome"}
                </option>
              ))}
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              Observações
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Opcional"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedPatient}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
