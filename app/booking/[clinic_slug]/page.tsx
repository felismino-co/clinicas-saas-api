"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Clinic = { id: string; name: string; logo_url: string | null };
type Provider = { id: string; full_name: string; specialty: string | null };
type Service = { id: string; name: string; duration_minutes: number | null; price: number | null };
type Slot = { starts_at: string; ends_at: string };

const STEPS = 5;

export default function BookingPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.clinic_slug as string;

  const [step, setStep] = useState(1);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [patient, setPatient] = useState({ name: "", phone: "", email: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchClinic = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/booking/clinic?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok) {
        const msg = (data as { message?: string }).message;
        setError(
          res.status === 404 || (data as { error?: string }).error === "not_found"
            ? "Link inválido ou clínica não encontrada."
            : msg ?? "Clínica não encontrada.",
        );
        setClinic(null);
        setProviders([]);
        setServices([]);
        return;
      }
      setClinic(data.clinic);
      setProviders(data.providers ?? []);
      setServices(data.services ?? []);
    } catch {
      setError("Erro ao carregar.");
      setClinic(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchClinic();
  }, [fetchClinic]);

  const fetchSlots = useCallback(async () => {
    if (!clinic?.id || !selectedDate || !selectedProvider) return;
    try {
      const res = await fetch(
        `/api/booking/slots?clinic_id=${encodeURIComponent(clinic.id)}&provider_id=${encodeURIComponent(selectedProvider.id)}&date=${selectedDate}`,
      );
      const data = await res.json();
      if (res.ok) setSlots(data.slots ?? []);
      else setSlots([]);
    } catch {
      setSlots([]);
    }
  }, [clinic?.id, selectedDate, selectedProvider]);

  useEffect(() => {
    if (step >= 3 && selectedDate && selectedProvider) fetchSlots();
  }, [step, selectedDate, selectedProvider, fetchSlots]);

  const handleConfirm = async () => {
    if (!clinic || !selectedService || !selectedProvider || !selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinic.id,
          patient_name: patient.name.trim(),
          patient_phone: patient.phone.trim(),
          patient_email: patient.email.trim() || undefined,
          provider_id: selectedProvider.id,
          service_id: selectedService.id,
          starts_at: selectedSlot.starts_at,
          ends_at: selectedSlot.ends_at,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { message?: string }).message ?? "Erro ao agendar.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Erro ao agendar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500">Carregando...</p>
      </div>
    );
  }

  if (error && !clinic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Link inválido ou clínica não encontrada</h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/landing")}
          className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Voltar
        </button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Agendamento confirmado!</h1>
        <p className="mt-2 text-slate-600">
          Você receberá uma confirmação no WhatsApp.
        </p>
        <button
          type="button"
          onClick={() => router.push("/landing")}
          className="mt-6 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

  const minDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-xl">
        {clinic && (
          <div className="mb-6 text-center">
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt="" className="mx-auto h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold text-emerald-700">
                {clinic.name.slice(0, 1)}
              </div>
            )}
            <h1 className="mt-2 text-xl font-bold text-slate-900">{clinic.name}</h1>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Etapa {step} de {STEPS}</p>

          {step === 1 && (
            <>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Selecione o serviço</h2>
              <div className="mt-4 grid gap-2">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedService(s)}
                    className={`rounded-lg border p-4 text-left transition ${
                      selectedService?.id === s.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-medium text-slate-900">{s.name}</span>
                    {(s.duration_minutes || s.price) && (
                      <span className="ml-2 text-sm text-slate-500">
                        {s.duration_minutes ? `${s.duration_minutes} min` : ""}
                        {s.duration_minutes && s.price ? " · " : ""}
                        {s.price != null ? `R$ ${Number(s.price).toFixed(2)}` : ""}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Selecione o profissional</h2>
              <div className="mt-4 grid gap-2">
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProvider(p)}
                    className={`rounded-lg border p-4 text-left transition ${
                      selectedProvider?.id === p.id
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-medium text-slate-900">{p.full_name}</span>
                    {p.specialty && (
                      <span className="ml-2 text-sm text-slate-500">{p.specialty}</span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Data e horário</h2>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Data</label>
                <input
                  type="date"
                  min={minDate}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {selectedDate && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700">Horário</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.length === 0 ? (
                      <p className="text-sm text-slate-500">Nenhum horário disponível.</p>
                    ) : (
                      slots.map((slot) => (
                        <button
                          key={slot.starts_at}
                          type="button"
                          onClick={() => setSelectedSlot(slot)}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                            selectedSlot?.starts_at === slot.starts_at
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {new Date(slot.starts_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Seus dados</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nome *</label>
                  <input
                    type="text"
                    value={patient.name}
                    onChange={(e) => setPatient((p) => ({ ...p, name: e.target.value }))}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Telefone *</label>
                  <input
                    type="tel"
                    value={patient.phone}
                    onChange={(e) => setPatient((p) => ({ ...p, phone: e.target.value }))}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={patient.email}
                    onChange={(e) => setPatient((p) => ({ ...p, email: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Confirmação</h2>
              <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
                <p><span className="font-medium text-slate-500">Serviço:</span> {selectedService?.name}</p>
                <p><span className="font-medium text-slate-500">Profissional:</span> {selectedProvider?.full_name}</p>
                <p>
                  <span className="font-medium text-slate-500">Data/hora:</span>{" "}
                  {selectedSlot && (
                    <>
                      {new Date(selectedSlot.starts_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}{" "}
                      às{" "}
                      {new Date(selectedSlot.starts_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </>
                  )}
                </p>
                <p><span className="font-medium text-slate-500">Nome:</span> {patient.name}</p>
                <p><span className="font-medium text-slate-500">Telefone:</span> {patient.phone}</p>
              </div>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Voltar
            </button>
            {step < STEPS ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 1 && !selectedService) ||
                  (step === 2 && !selectedProvider) ||
                  (step === 3 && (!selectedDate || !selectedSlot)) ||
                  (step === 4 && (!patient.name.trim() || !patient.phone.trim()))
                }
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Próximo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={submitting}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Agendando..." : "Confirmar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
