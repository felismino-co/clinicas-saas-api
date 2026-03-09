"use client";

import { useEffect, useState } from "react";

type Patient = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birth_date?: string | null;
  tags: string[] | string | null;
  appointments_count?: number;
  last_appointment_at?: string | null;
  computed_tags?: string[];
  blocked?: boolean;
};

type AppointmentItem = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  providers?: { full_name?: string | null } | null;
  services?: { name?: string | null } | null;
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  no_show: "Faltou",
  completed: "Concluído",
};

const STATUS_CLASSES: Record<string, string> = {
  scheduled: "bg-amber-100 text-amber-800",
  confirmed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-rose-100 text-rose-800",
  no_show: "bg-slate-100 text-slate-700",
  completed: "bg-sky-100 text-sky-800",
};

type Props = {
  patientId: string;
  clinicId: string;
  onClose: () => void;
};

function tagsToArray(tags: Patient["tags"]): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function PatientDrawer({
  patientId,
  clinicId,
  onClose,
}: Props) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [whatsappMessages, setWhatsappMessages] = useState<Array<{ direction: string; content: string; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patchingBlock, setPatchingBlock] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [patientRes, appointmentsRes] = await Promise.all([
          fetch(
            `/api/patients/${patientId}?clinic_id=${encodeURIComponent(clinicId)}`,
          ),
          fetch(
            `/api/appointments?clinic_id=${encodeURIComponent(clinicId)}&patient_id=${encodeURIComponent(patientId)}`,
          ),
        ]);

        const patientData = await patientRes.json().catch(() => ({}));
        const appointmentsData = await appointmentsRes.json().catch(() => ({}));

        if (cancelled) return;

        if (!patientRes.ok) {
          setError(
            (patientData && patientData.message) || "Paciente não encontrado.",
          );
          setPatient(null);
          setAppointments([]);
          return;
        }

        setPatient(patientData.patient ?? null);
        setAppointments(appointmentsData.appointments ?? []);

        const pid = patientData.patient?.id;
        if (pid) {
          const convRes = await fetch(`/api/inbox/conversations?clinic_id=${encodeURIComponent(clinicId)}`);
          const convData = await convRes.json().catch(() => ({}));
          const convs = convData.conversations ?? [];
          const conv = convs.find((c: { patient_id: string | null }) => c.patient_id === pid);
          if (conv?.id) {
            const msgRes = await fetch(`/api/inbox/messages?conversation_id=${encodeURIComponent(conv.id)}`);
            const msgData = await msgRes.json().catch(() => ({}));
            setWhatsappMessages(msgData.messages ?? []);
          } else {
            setWhatsappMessages([]);
          }
        } else {
          setWhatsappMessages([]);
        }
      } catch {
        if (!cancelled) {
          setError("Erro ao carregar dados.");
          setPatient(null);
          setAppointments([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [patientId, clinicId]);

  const tags = patient ? [...(patient.computed_tags ?? []), ...tagsToArray(patient.tags)] : [];
  const tagsUnique = [...new Set(tags)];

  const handleBlock = async (blocked: boolean) => {
    if (!patientId) return;
    setPatchingBlock(true);
    try {
      const res = await fetch(`/api/patients/${patientId}?clinic_id=${encodeURIComponent(clinicId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked }),
      });
      if (res.ok) {
        const data = await res.json();
        setPatient((prev) => (prev ? { ...prev, blocked: data.patient?.blocked ?? blocked } : null));
      }
    } finally {
      setPatchingBlock(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed right-0 top-0 z-50 h-screen w-96 overflow-y-auto bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-drawer-title"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 p-8 text-slate-500">
            <span className="text-sm">Carregando...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col gap-2 p-6">
            <p className="text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        ) : patient ? (
          <div className="flex flex-col">
            <header className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <h2
                id="patient-drawer-title"
                className="text-lg font-semibold text-slate-900"
              >
                {patient.full_name || "Sem nome"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </header>

            <div className="flex flex-col gap-4 p-4">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Dados
                </h3>
                <dl className="space-y-1.5 text-sm">
                  {patient.birth_date && (
                    <div>
                      <dt className="text-slate-500">Data de nascimento</dt>
                      <dd className="font-medium text-slate-900">
                        {new Date(patient.birth_date + "T12:00:00").toLocaleDateString("pt-BR")}
                        {(() => {
                          const today = new Date();
                          const birth = new Date(patient.birth_date! + "T12:00:00");
                          let age = today.getFullYear() - birth.getFullYear();
                          const m = today.getMonth() - birth.getMonth();
                          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
                          return age >= 0 ? ` (${age} anos)` : "";
                        })()}
                      </dd>
                    </div>
                  )}
                  {patient.phone && (
                    <div>
                      <dt className="text-slate-500">Telefone</dt>
                      <dd className="font-medium text-slate-900">{patient.phone}</dd>
                    </div>
                  )}
                  {patient.email && (
                    <div>
                      <dt className="text-slate-500">Email</dt>
                      <dd className="font-medium text-slate-900">{patient.email}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-slate-500">Consultas</dt>
                    <dd className="font-medium text-slate-900">{patient.appointments_count ?? 0}</dd>
                  </div>
                  {patient.last_appointment_at && (
                    <div>
                      <dt className="text-slate-500">Última consulta</dt>
                      <dd className="font-medium text-slate-900">
                        {new Date(patient.last_appointment_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </dd>
                    </div>
                  )}
                  {tagsUnique.length > 0 && (
                    <div>
                      <dt className="mb-1 text-slate-500">Tags</dt>
                      <dd className="flex flex-wrap gap-1">
                        {tagsUnique.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-slate-500 mb-1">Status</dt>
                    <dd>
                      {patient.blocked ? (
                        <button
                          type="button"
                          disabled={patchingBlock}
                          onClick={() => handleBlock(false)}
                          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Desbloquear
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={patchingBlock}
                          onClick={() => handleBlock(true)}
                          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          Bloquear
                        </button>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Histórico de agendamentos
                </h3>
                {appointments.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum agendamento anterior.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {appointments.map((a) => {
                      const start = new Date(a.starts_at);
                      const dateStr = start.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      });
                      const timeStr = start.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const providerName =
                        a.providers?.full_name || "—";
                      const serviceName = a.services?.name || "—";
                      const statusLabel = STATUS_LABELS[a.status] || a.status;
                      const statusClass =
                        STATUS_CLASSES[a.status] ||
                        "bg-slate-100 text-slate-700";
                      return (
                        <li
                          key={a.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900">
                              {dateStr} às {timeStr}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <div className="mt-1 text-slate-600">
                            {providerName} · {serviceName}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mensagens WhatsApp
                </h3>
                {whatsappMessages.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma mensagem.</p>
                ) : (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {whatsappMessages.map((m, i) => (
                      <li
                        key={i}
                        className={`rounded-lg px-3 py-2 text-sm ${
                          m.direction === "outbound"
                            ? "ml-8 bg-emerald-50 text-slate-900"
                            : "mr-8 bg-slate-100 text-slate-900"
                        }`}
                      >
                        <span className="text-xs text-slate-500">
                          {new Date(m.created_at).toLocaleString("pt-BR")} · {m.direction === "outbound" ? "Enviada" : "Recebida"}
                        </span>
                        <p className="mt-0.5">{m.content}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
