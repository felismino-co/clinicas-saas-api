"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clinic, setClinic] = useState({
    name: "",
    phone: "",
    address: "",
    email: "",
  });
  const [provider, setProvider] = useState({ full_name: "", specialty: "" });
  const [service, setService] = useState({
    name: "",
    duration_minutes: "",
    price: "",
  });

  const progress = (step / STEPS) * 100;

  const handleNext = () => {
    setError(null);
    if (step < STEPS) setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic: {
            name: clinic.name.trim(),
            phone: clinic.phone.trim() || undefined,
            address: clinic.address.trim() || undefined,
            email: clinic.email.trim() || undefined,
          },
          provider: {
            full_name: provider.full_name.trim(),
            specialty: provider.specialty.trim() || undefined,
          },
          service: {
            name: service.name.trim(),
            duration_minutes: service.duration_minutes ? parseInt(service.duration_minutes, 10) : undefined,
            price: service.price ? parseFloat(service.price.replace(",", ".")) : undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { message?: string }).message ?? "Erro ao cadastrar.");
        return;
      }
      router.push("/owner");
      router.refresh();
    } catch {
      setError("Erro ao cadastrar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-xl">
        <h1 className="text-center text-2xl font-bold text-slate-900">Nova clínica</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Etapa {step} de {STEPS}
        </p>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Dados da clínica</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nome *</label>
                  <input
                    type="text"
                    value={clinic.name}
                    onChange={(e) => setClinic((c) => ({ ...c, name: e.target.value }))}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Telefone</label>
                  <input
                    type="tel"
                    value={clinic.phone}
                    onChange={(e) => setClinic((c) => ({ ...c, phone: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Endereço</label>
                  <input
                    type="text"
                    value={clinic.address}
                    onChange={(e) => setClinic((c) => ({ ...c, address: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={clinic.email}
                    onChange={(e) => setClinic((c) => ({ ...c, email: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Primeiro profissional</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nome *</label>
                  <input
                    type="text"
                    value={provider.full_name}
                    onChange={(e) => setProvider((p) => ({ ...p, full_name: e.target.value }))}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Especialidade</label>
                  <input
                    type="text"
                    value={provider.specialty}
                    onChange={(e) => setProvider((p) => ({ ...p, specialty: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Primeiro serviço</h2>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Nome *</label>
                  <input
                    type="text"
                    value={service.name}
                    onChange={(e) => setService((s) => ({ ...s, name: e.target.value }))}
                    required
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Duração (minutos)</label>
                  <input
                    type="number"
                    min={1}
                    value={service.duration_minutes}
                    onChange={(e) => setService((s) => ({ ...s, duration_minutes: e.target.value }))}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Preço (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={service.price}
                    onChange={(e) => setService((s) => ({ ...s, price: e.target.value }))}
                    placeholder="0,00"
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-lg font-semibold text-slate-900">Confirmação</h2>
              <div className="mt-4 space-y-3 rounded-lg bg-slate-50 p-4 text-sm">
                <p><span className="font-medium text-slate-500">Clínica:</span> {clinic.name || "—"}</p>
                <p><span className="font-medium text-slate-500">Telefone:</span> {clinic.phone || "—"}</p>
                <p><span className="font-medium text-slate-500">Endereço:</span> {clinic.address || "—"}</p>
                <p><span className="font-medium text-slate-500">Email:</span> {clinic.email || "—"}</p>
                <p><span className="font-medium text-slate-500">Profissional:</span> {provider.full_name || "—"} {provider.specialty ? `(${provider.specialty})` : ""}</p>
                <p><span className="font-medium text-slate-500">Serviço:</span> {service.name || "—"} {service.duration_minutes ? ` · ${service.duration_minutes} min` : ""} {service.price ? ` · R$ ${service.price}` : ""}</p>
              </div>
              <p className="mt-4 text-sm text-slate-600">Revise os dados e clique em &quot;Ir para o painel&quot; para concluir.</p>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          )}

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
            >
              Voltar
            </button>
            {step < STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={(step === 1 && !clinic.name.trim()) || (step === 2 && !provider.full_name.trim()) || (step === 3 && !service.name.trim())}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Próximo
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "Salvando..." : "Ir para o painel"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
