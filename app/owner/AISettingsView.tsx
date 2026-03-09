"use client";

import { useEffect, useState } from "react";
import AITestChat from "./AITestChat";
import { getContextTemplate, type ClinicType } from "../../lib/ai-templates";

type Profile = {
  id?: string;
  clinic_id?: string;
  assistant_name: string;
  tone: string;
  context: string;
  is_active?: boolean;
  automations?: {
    reminder_48h: boolean;
    reminder_24h: boolean;
    post_2h: boolean;
    post_7d: boolean;
    reactivation_90: boolean;
  };
};

const TONES = [
  { value: "humanizado", label: "Humanizado" },
  { value: "formal", label: "Formal" },
  { value: "descontraído", label: "Descontraído" },
  { value: "persuasivo", label: "Persuasivo" },
];

type Props = {
  clinicId: string;
};

export default function AISettingsView({ clinicId }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showTestChat, setShowTestChat] = useState(false);
  const [clinicType, setClinicType] = useState<ClinicType>("geral");
  const [form, setForm] = useState({
    assistant_name: "Ana",
    tone: "humanizado",
    context: "",
    reminder_48h: true,
    reminder_24h: true,
    post_2h: true,
    post_7d: true,
    reactivation_90: true,
  });

  useEffect(() => {
    fetch(`/api/ai/profile?clinic_id=${encodeURIComponent(clinicId)}`)
      .then((res) => res.json())
      .then((data) => {
        const p = data.profile;
        if (p) {
          setProfile(p);
          setForm({
            assistant_name: p.assistant_name ?? "Ana",
            tone: p.tone ?? "humanizado",
            context: p.context ?? "",
            reminder_48h: p.automations?.reminder_48h !== false,
            reminder_24h: p.automations?.reminder_24h !== false,
            post_2h: p.automations?.post_2h !== false,
            post_7d: p.automations?.post_7d !== false,
            reactivation_90: p.automations?.reactivation_90 !== false,
          });
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [clinicId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/ai/profile?clinic_id=${encodeURIComponent(clinicId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistant_name: form.assistant_name.trim(),
          tone: form.tone,
          context: form.context.trim(),
          automations: {
            reminder_48h: form.reminder_48h,
            reminder_24h: form.reminder_24h,
            post_2h: form.post_2h,
            post_7d: form.post_7d,
            reactivation_90: form.reactivation_90,
          },
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setProfile(data.profile ?? profile);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Configurações da IA</h2>
        <button
          type="button"
          onClick={() => setShowTestChat(true)}
          className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Testar IA
        </button>
      </div>

      <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nome do assistente</label>
            <input
              type="text"
              value={form.assistant_name}
              onChange={(e) => setForm((f) => ({ ...f, assistant_name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Tom de voz</label>
            <select
              value={form.tone}
              onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Tipo de clínica</label>
            <select
              value={clinicType}
              onChange={(e) => setClinicType(e.target.value as ClinicType)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="geral">Geral</option>
              <option value="odontologia">Odontologia</option>
              <option value="estetica">Estética</option>
              <option value="cirurgia">Cirurgia</option>
              <option value="nutricao">Nutrição</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-700">Contexto / prompt base</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, context: getContextTemplate(clinicType) }))}
                className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Carregar template
              </button>
            </div>
            <textarea
              value={form.context}
              onChange={(e) => setForm((f) => ({ ...f, context: e.target.value }))}
              rows={6}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Instruções gerais para a IA (ex: nome da clínica, horários, serviços)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Automações ativas</label>
            <div className="space-y-2">
              {[
                { key: "reminder_48h", label: "Lembrete 48h antes" },
                { key: "reminder_24h", label: "Lembrete 24h antes" },
                { key: "post_2h", label: "Mensagem pós-consulta (2h)" },
                { key: "post_7d", label: "Mensagem pós-consulta (7 dias)" },
                { key: "reactivation_90", label: "Reativação (90 dias sem consulta)" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form[key as keyof typeof form] as boolean}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [key]: e.target.checked }))
                    }
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </form>

      {showTestChat && (
        <AITestChat clinicId={clinicId} onClose={() => setShowTestChat(false)} />
      )}
    </div>
  );
}
