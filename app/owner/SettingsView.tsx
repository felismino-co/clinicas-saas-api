"use client";

import { useEffect, useState } from "react";

type Clinic = {
  id: string;
  name: string;
  phone: string;
  address?: string;
};

type ClinicSettings = {
  open_time?: string;
  close_time?: string;
  days_of_week?: number[];
};

const DAYS_LABELS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

type Props = {
  clinicId: string;
};

export default function SettingsView({ clinicId }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("18:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`/api/owner/clinic?clinic_id=${encodeURIComponent(clinicId)}`).then((r) => r.json()),
      fetch(`/api/owner/clinic-settings?clinic_id=${encodeURIComponent(clinicId)}`).then((r) => r.json()),
    ])
      .then(([data, settingsData]) => {
        if (cancelled) return;
        if (data.error || !data.clinic) {
          setError(data.message || "Clínica não encontrada.");
          return;
        }
        const c = data.clinic as Clinic;
        setName(c.name ?? "");
        setPhone(c.phone ?? "");
        setAddress(c.address ?? "");
        const s = (settingsData.settings || settingsData) as ClinicSettings;
        if (s.open_time) setOpenTime(s.open_time);
        if (s.close_time) setCloseTime(s.close_time);
        if (Array.isArray(s.days_of_week)) setDaysOfWeek(s.days_of_week);
      })
      .catch(() => {
        if (!cancelled) setError("Erro ao carregar clínica.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const [resClinic, resSettings] = await Promise.all([
        fetch(`/api/owner/clinic?clinic_id=${encodeURIComponent(clinicId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim() || null,
            address: address.trim() || null,
          }),
        }),
        fetch(`/api/owner/clinic-settings?clinic_id=${encodeURIComponent(clinicId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            open_time: openTime,
            close_time: closeTime,
            days_of_week: daysOfWeek,
          }),
        }),
      ]);
      const data = await resClinic.json();
      if (!resClinic.ok) {
        setError(data?.message ?? "Erro ao salvar.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Erro ao salvar.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        Carregando...
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dados da clínica
        </h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="clinic-name"
              className="block text-sm font-medium text-slate-700"
            >
              Nome da clínica
            </label>
            <input
              id="clinic-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label
              htmlFor="clinic-phone"
              className="block text-sm font-medium text-slate-700"
            >
              Telefone
            </label>
            <input
              id="clinic-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label
              htmlFor="clinic-address"
              className="block text-sm font-medium text-slate-700"
            >
              Endereço <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              id="clinic-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>
        </div>
        {error && (
          <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Configurações salvas.
          </p>
        )}
        <div className="mt-4">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>

      <form
        onSubmit={handleSubmit}
        className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Horário de funcionamento
        </h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Abertura</label>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Fechamento</label>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Dias da semana</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_LABELS.map((d) => (
                <label key={d.value} className="inline-flex items-center gap-1 rounded border border-slate-200 px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={daysOfWeek.includes(d.value)}
                    onChange={() => toggleDay(d.value)}
                    className="rounded border-slate-300"
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {submitting ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
