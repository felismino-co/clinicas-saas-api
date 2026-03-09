"use client";

import { useEffect, useState } from "react";
import type { ToastType } from "../secretary/Toast";

type Campaign = {
  id: string;
  clinic_id: string;
  name: string;
  segment: string;
  message_template: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_sent: number;
  created_at: string;
};

const SEGMENTS = [
  { value: "todos", label: "Todos" },
  { value: "inativos", label: "Inativos (90+ dias)" },
  { value: "vip", label: "VIP (5+ consultas)" },
  { value: "novos", label: "Novos (últimos 30 dias)" },
];

type Props = {
  clinicId: string;
  showToast?: (message: string, type: ToastType) => void;
};

export default function CampaignsView({ clinicId, showToast }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("todos");
  const [messageTemplate, setMessageTemplate] = useState("Olá {nome}! Mensagem da {clinica}.");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`/api/campaigns?clinic_id=${encodeURIComponent(clinicId)}`);
      const data = await res.json();
      if (res.ok) setCampaigns(data.campaigns ?? []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [clinicId]);

  const handleCreate = async (e: React.FormEvent, sendNow: boolean) => {
    e.preventDefault();
    if (!name.trim() || !messageTemplate.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          name: name.trim(),
          segment,
          message_template: messageTemplate.trim(),
          scheduled_at: sendNow ? null : scheduledAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast?.(data?.message ?? "Erro ao criar campanha.", "error");
        return;
      }
      const campaignId = (data.campaign as { id: string }).id;
      if (sendNow) {
        setSendingId(campaignId);
        const sendRes = await fetch("/api/campaigns/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id: campaignId }),
        });
        const sendData = await sendRes.json();
        setSendingId(null);
        if (sendRes.ok) {
          showToast?.(`Campanha enviada. ${sendData.sent_count ?? 0} mensagens.`, "success");
        } else {
          showToast?.(sendData?.message ?? "Erro ao enviar.", "error");
        }
      } else {
        showToast?.("Campanha agendada.", "success");
      }
      setShowModal(false);
      setName("");
      setSegment("todos");
      setMessageTemplate("Olá {nome}! Mensagem da {clinica}.");
      setScheduledAt("");
      fetchCampaigns();
    } catch {
      showToast?.("Erro ao criar campanha.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendNow = async (campaignId: string) => {
    setSendingId(campaignId);
    try {
      const res = await fetch("/api/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast?.(`Enviada. ${data.sent_count ?? 0} mensagens.`, "success");
        fetchCampaigns();
      } else {
        showToast?.(data?.message ?? "Erro ao enviar.", "error");
      }
    } catch {
      showToast?.("Erro ao enviar.", "error");
    } finally {
      setSendingId(null);
    }
  };

  const preview = messageTemplate.replace(/\{nome\}/gi, "Maria").replace(/\{clinica\}/gi, "Clínica Exemplo");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Campanhas</h2>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Nova Campanha
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Carregando...</p>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-slate-500">Nenhuma campanha. Crie uma para enviar mensagens em massa.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="font-medium text-slate-900">{c.name}</p>
              <p className="text-xs text-slate-500">
                Segmento: {SEGMENTS.find((s) => s.value === c.segment)?.label ?? c.segment}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Status: {c.status === "draft" ? "Rascunho" : c.status === "scheduled" ? "Agendada" : "Enviada"}
                {c.total_sent > 0 && ` · ${c.total_sent} enviados`}
              </p>
              {c.status !== "sent" && (
                <button
                  type="button"
                  disabled={sendingId === c.id}
                  onClick={() => handleSendNow(c.id)}
                  className="mt-3 rounded border border-indigo-600 px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                >
                  {sendingId === c.id ? "Enviando..." : "Enviar agora"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setShowModal(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Nova Campanha</h3>
            <form onSubmit={(e) => e.preventDefault()} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Segmento</label>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  {SEGMENTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Mensagem (use {"{nome}"} e {"{clinica}"})</label>
                <textarea
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Preview</label>
                <p className="mt-1 rounded bg-slate-100 p-2 text-sm text-slate-700">{preview}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Data/hora de envio (opcional)</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
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
                  type="button"
                  onClick={(e) => handleCreate(e, false)}
                  disabled={submitting}
                  className="rounded-md bg-slate-600 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  Agendar
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCreate(e, true)}
                  disabled={submitting}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Enviar agora
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
