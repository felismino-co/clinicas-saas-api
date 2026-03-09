"use client";

import { useEffect, useState } from "react";
import ConfirmDialog from "../secretary/ConfirmDialog";

const DAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

type Provider = {
  id: string;
  clinic_id: string;
  full_name: string | null;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  crm?: string | null;
};

type ScheduleRow = {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type Block = {
  id: string;
  blocked_date: string;
  reason: string | null;
};

type ToastType = "success" | "error" | "info";
type Props = {
  clinicId: string;
  showToast?: (message: string, type: ToastType) => void;
};

export default function ProvidersView({ clinicId, showToast }: Props) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSpecialty, setNewSpecialty] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCrm, setNewCrm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerProvider, setDrawerProvider] = useState<Provider | null>(null);
  const [drawerTab, setDrawerTab] = useState<"dados" | "agenda" | "bloqueios" | "integracoes">("dados");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const fetchProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/owner/providers?clinic_id=${encodeURIComponent(clinicId)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Erro ao carregar.");
        setProviders([]);
        return;
      }
      setProviders(data.providers ?? []);
    } catch {
      setError("Erro ao carregar.");
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [clinicId]);

  const handleDelete = (providerId: string) => setConfirmRemoveId(providerId);

  const handleConfirmRemove = async () => {
    const id = confirmRemoveId;
    setConfirmRemoveId(null);
    if (!id) return;
    setError(null);
    try {
      const res = await fetch(`/api/owner/providers/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Erro ao remover.");
        showToast?.(data?.message ?? "Erro ao remover.", "error");
        return;
      }
      if (drawerProvider?.id === id) setDrawerProvider(null);
      fetchProviders();
      showToast?.("Profissional removido.", "success");
    } catch {
      setError("Erro ao remover.");
      showToast?.("Erro ao remover.", "error");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          full_name: newName.trim(),
          specialty: newSpecialty.trim() || null,
          phone: newPhone.trim() || null,
          email: newEmail.trim() || null,
          crm: newCrm.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Erro ao criar.");
        return;
      }
      setShowModal(false);
      setNewName("");
      setNewSpecialty("");
      setNewPhone("");
      setNewEmail("");
      setNewCrm("");
      fetchProviders();
      showToast?.("Profissional criado.", "success");
    } catch {
      setError("Erro ao criar.");
      showToast?.("Erro ao criar.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Profissionais</h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Novo Profissional
        </button>
      </div>
      {error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : providers.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhum profissional cadastrado.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <div
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => setDrawerProvider(p)}
              onKeyDown={(e) => e.key === "Enter" && setDrawerProvider(p)}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {p.full_name || "Sem nome"}
                </p>
                <p className="text-xs text-slate-500">
                  Especialidade: {p.specialty || "—"}
                  {p.phone ? ` · ${p.phone}` : ""}
                </p>
              </div>
              <span className="text-slate-400">→</span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40"
            onClick={() => setShowModal(false)}
            aria-hidden
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              Novo Profissional
            </h3>
            <form onSubmit={handleCreate} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Especialidade (opcional)</label>
                <input
                  type="text"
                  value={newSpecialty}
                  onChange={(e) => setNewSpecialty(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Telefone (opcional)</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Email (opcional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">CRM (opcional)</label>
                <input
                  type="text"
                  value={newCrm}
                  onChange={(e) => setNewCrm(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {drawerProvider && (
        <ProviderDrawer
          provider={drawerProvider}
          clinicId={clinicId}
          onClose={() => setDrawerProvider(null)}
          onSaved={(updated) => {
            setDrawerProvider(updated);
            fetchProviders();
          }}
          showToast={showToast}
          onDelete={() => handleDelete(drawerProvider.id)}
        />
      )}

      {confirmRemoveId && (
        <ConfirmDialog
          message="Remover este profissional?"
          confirmLabel="Remover"
          variant="danger"
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmRemoveId(null)}
        />
      )}
    </div>
  );
}

function ProviderDrawer({
  provider,
  clinicId,
  onClose,
  onSaved,
  showToast,
  onDelete,
}: {
  provider: Provider;
  clinicId: string;
  onClose: () => void;
  onSaved: (p: Provider) => void;
  showToast?: (m: string, t: ToastType) => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<"dados" | "agenda" | "bloqueios" | "integracoes">("dados");
  const [fullName, setFullName] = useState(provider.full_name ?? "");
  const [specialty, setSpecialty] = useState(provider.specialty ?? "");
  const [phone, setPhone] = useState(provider.phone ?? "");
  const [email, setEmail] = useState(provider.email ?? "");
  const [crm, setCrm] = useState(provider.crm ?? "");
  const [saving, setSaving] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [googleCalendarEmail, setGoogleCalendarEmail] = useState<string | null>(null);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);
  const [googleCalendarDisconnecting, setGoogleCalendarDisconnecting] = useState(false);

  useEffect(() => {
    setFullName(provider.full_name ?? "");
    setSpecialty(provider.specialty ?? "");
    setPhone(provider.phone ?? "");
    setEmail(provider.email ?? "");
    setCrm(provider.crm ?? "");
  }, [provider]);

  useEffect(() => {
    if (tab === "agenda" && provider.id) {
      setScheduleLoading(true);
      fetch(`/api/owner/providers/${provider.id}/schedule`)
        .then((r) => r.json())
        .then((d) => {
          const list = (d.schedules ?? []) as ScheduleRow[];
          if (list.length > 0) {
            setSchedules(list.map((s) => ({ ...s, start_time: String(s.start_time).slice(0, 5), end_time: String(s.end_time).slice(0, 5) })));
          } else {
            setSchedules(DAYS.map((d) => ({ day_of_week: d.value, start_time: "08:00", end_time: "18:00" })));
          }
        })
        .finally(() => setScheduleLoading(false));
    }
  }, [tab, provider.id]);

  useEffect(() => {
    if (tab === "bloqueios" && provider.id) {
      setBlocksLoading(true);
      fetch(`/api/owner/providers/${provider.id}/blocks`)
        .then((r) => r.json())
        .then((d) => setBlocks(d.blocks ?? []))
        .finally(() => setBlocksLoading(false));
    }
  }, [tab, provider.id]);

  useEffect(() => {
    if (tab === "integracoes" && provider.id) {
      setIntegrationsLoading(true);
      fetch(`/api/integrations/google-calendar?provider_id=${encodeURIComponent(provider.id)}`)
        .then((r) => r.json())
        .then((d) => {
          setGoogleCalendarConnected(Boolean(d.connected));
          setGoogleCalendarEmail(d.email ?? null);
        })
        .finally(() => setIntegrationsLoading(false));
    }
  }, [tab, provider.id]);

  const saveDados = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/owner/providers/${provider.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName.trim(),
          specialty: specialty.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          crm: crm.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.provider) {
        onSaved({ ...provider, ...data.provider });
        showToast?.("Dados salvos.", "success");
      } else {
        showToast?.(data?.message ?? "Erro ao salvar.", "error");
      }
    } catch {
      showToast?.("Erro ao salvar.", "error");
    } finally {
      setSaving(false);
    }
  };

  const saveAgenda = async () => {
    setSaving(true);
    try {
      const active = schedules.filter((s) => s.start_time && s.end_time);
      const res = await fetch(`/api/owner/providers/${provider.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          schedules: active.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time.length === 5 ? s.start_time + ":00" : s.start_time,
            end_time: s.end_time.length === 5 ? s.end_time + ":00" : s.end_time,
          })),
        }),
      });
      if (res.ok) {
        showToast?.("Agenda salva.", "success");
        const data = await res.json();
        setSchedules((data.schedules ?? []).map((s: ScheduleRow & { start_time?: string }) => ({
          ...s,
          start_time: String(s.start_time ?? "").slice(0, 5),
          end_time: String(s.end_time ?? "").slice(0, 5),
        })));
      } else {
        const data = await res.json();
        showToast?.(data?.message ?? "Erro ao salvar agenda.", "error");
      }
    } catch {
      showToast?.("Erro ao salvar agenda.", "error");
    } finally {
      setSaving(false);
    }
  };

  const addBlock = async () => {
    if (!newBlockDate.trim()) return;
    try {
      const res = await fetch(`/api/owner/providers/${provider.id}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          blocked_date: newBlockDate.slice(0, 10),
          reason: newBlockReason.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.block) {
        setBlocks((prev) => [{ ...data.block, blocked_date: data.block.blocked_date, reason: data.block.reason }].concat(prev));
        setNewBlockDate("");
        setNewBlockReason("");
        showToast?.("Bloqueio adicionado.", "success");
      } else {
        showToast?.(data?.message ?? "Erro ao adicionar.", "error");
      }
    } catch {
      showToast?.("Erro ao adicionar bloqueio.", "error");
    }
  };

  const removeBlock = async (blockId: string) => {
    try {
      const res = await fetch(`/api/owner/providers/${provider.id}/blocks?block_id=${encodeURIComponent(blockId)}`, { method: "DELETE" });
      if (res.ok) {
        setBlocks((prev) => prev.filter((b) => b.id !== blockId));
        showToast?.("Bloqueio removido.", "success");
      }
    } catch {
      showToast?.("Erro ao remover.", "error");
    }
  };

  const toggleDay = (dayOfWeek: number) => {
    const exists = schedules.some((s) => s.day_of_week === dayOfWeek);
    if (exists) {
      setSchedules((prev) => prev.filter((s) => s.day_of_week !== dayOfWeek));
    } else {
      setSchedules((prev) => [...prev, { day_of_week: dayOfWeek, start_time: "08:00", end_time: "18:00" }].sort((a, b) => a.day_of_week - b.day_of_week));
    }
  };

  const updateScheduleTime = (dayOfWeek: number, field: "start_time" | "end_time", value: string) => {
    setSchedules((prev) => {
      const idx = prev.findIndex((s) => s.day_of_week === dayOfWeek);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-slate-200 bg-white shadow-xl">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-semibold text-slate-900">{provider.full_name || "Profissional"}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {(["dados", "agenda", "bloqueios", "integracoes"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`shrink-0 px-3 py-2 text-sm font-medium capitalize ${tab === t ? "border-b-2 border-indigo-600 text-indigo-600" : "text-slate-600"}`}
            >
              {t === "dados" ? "Dados" : t === "agenda" ? "Agenda" : t === "bloqueios" ? "Bloqueios" : "Integrações"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === "dados" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500">Nome</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Especialidade</label>
                <input type="text" value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Telefone</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">CRM</label>
                <input type="text" value={crm} onChange={(e) => setCrm(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <button type="button" onClick={saveDados} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? "Salvando..." : "Salvar dados"}
              </button>
            </div>
          )}

          {tab === "agenda" && (
            <div className="space-y-4">
              {scheduleLoading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : (
                <>
                  <p className="text-xs text-slate-500">Marque os dias e horários de atendimento.</p>
                  {DAYS.map((day) => {
                    const row = schedules.find((s) => s.day_of_week === day.value);
                    const isActive = !!row;
                    return (
                      <div key={day.value} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 p-2">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={isActive} onChange={() => toggleDay(day.value)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                          <span className="text-sm font-medium">{day.label}</span>
                        </label>
                        {isActive && (
                          <>
                            <input
                              type="time"
                              value={row?.start_time ?? "08:00"}
                              onChange={(e) => updateScheduleTime(day.value, "start_time", e.target.value)}
                              className="rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                            <span className="text-slate-400">–</span>
                            <input
                              type="time"
                              value={row?.end_time ?? "18:00"}
                              onChange={(e) => updateScheduleTime(day.value, "end_time", e.target.value)}
                              className="rounded border border-slate-300 px-2 py-1 text-sm"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={saveAgenda} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
                    {saving ? "Salvando..." : "Salvar agenda"}
                  </button>
                </>
              )}
            </div>
          )}

          {tab === "bloqueios" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={newBlockDate}
                  onChange={(e) => setNewBlockDate(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={newBlockReason}
                  onChange={(e) => setNewBlockReason(e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <button type="button" onClick={addBlock} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
                  Adicionar bloqueio
                </button>
              </div>
              {blocksLoading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : blocks.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma data bloqueada.</p>
              ) : (
                <ul className="space-y-2">
                  {blocks.map((b) => (
                    <li key={b.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div>
                        <span className="font-medium">{new Date(b.blocked_date).toLocaleDateString("pt-BR")}</span>
                        {b.reason && <span className="ml-2 text-sm text-slate-500">{b.reason}</span>}
                      </div>
                      <button type="button" onClick={() => removeBlock(b.id)} className="text-rose-600 hover:underline text-sm">
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "integracoes" && (
            <div className="space-y-4">
              {integrationsLoading ? (
                <p className="text-sm text-slate-500">Carregando...</p>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span>
                    <h4 className="font-semibold text-slate-900">Google Calendar</h4>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Sincronize a agenda do médico com o Google Calendar. Agendamentos criados no sistema poderão ser refletidos no calendário do profissional.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Em breve — disponível na próxima versão
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {googleCalendarConnected ? (
                      <>
                        <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Conectado</span>
                        {googleCalendarEmail && <span className="text-sm text-slate-600">{googleCalendarEmail}</span>}
                        <button
                          type="button"
                          disabled={googleCalendarDisconnecting}
                          onClick={async () => {
                            setGoogleCalendarDisconnecting(true);
                            try {
                              const r = await fetch(`/api/integrations/google-calendar?provider_id=${encodeURIComponent(provider.id)}`, { method: "DELETE" });
                              if (r.ok) {
                                setGoogleCalendarConnected(false);
                                setGoogleCalendarEmail(null);
                                showToast?.("Google Calendar desconectado.", "success");
                              }
                            } finally {
                              setGoogleCalendarDisconnecting(false);
                            }
                          }}
                          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {googleCalendarDisconnecting ? "Desconectando..." : "Desconectar"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="rounded-lg border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-500 cursor-not-allowed"
                        title="Disponível em breve"
                      >
                        Conectar Google Calendar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={onDelete} className="rounded border border-rose-200 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50">
            Remover profissional
          </button>
        </div>
      </div>
    </div>
  );
}
