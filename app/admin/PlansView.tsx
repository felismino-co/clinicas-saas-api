"use client";

import { useEffect, useState } from "react";

type Plan = {
  id: string;
  name: string;
  price_month: number;
  description: string;
  max_providers: number | null;
  is_active?: boolean;
};

const defaultPlans: Plan[] = [
  { id: "", name: "Básico", price_month: 197, description: "Ideal para clínicas pequenas", max_providers: 2 },
  { id: "", name: "Pro", price_month: 397, description: "Para clínicas em crescimento", max_providers: 5 },
  { id: "", name: "Enterprise", price_month: 797, description: "Sem limites", max_providers: 999 },
];

export default function PlansView() {
  const [plans, setPlans] = useState<Plan[]>(defaultPlans);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((d) => {
        if (d.plans?.length) setPlans(d.plans);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (plan: Plan, field: keyof Plan, value: string | number | null) => {
    setPlans((prev) =>
      prev.map((p) =>
        (p.id && p.id === plan.id) || (!p.id && p.name === plan.name)
          ? { ...p, [field]: value }
          : p,
      ),
    );
  };

  const handleSave = async (plan: Plan) => {
    if (!plan.id) {
      setMessage({ type: "err", text: "Plano ainda não existe no banco. Execute sql/plans.sql." });
      return;
    }
    setSavingId(plan.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/plans?id=${encodeURIComponent(plan.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: plan.name,
          price_month: plan.price_month,
          description: plan.description || undefined,
          max_providers: plan.max_providers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: (data as { message?: string }).message ?? "Erro ao salvar." });
        return;
      }
      setMessage({ type: "ok", text: "Plano salvo." });
    } catch {
      setMessage({ type: "err", text: "Erro ao salvar." });
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Carregando planos...
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Planos</h1>
      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-2 text-sm ${
            message.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {message.text}
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id || plan.name}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500">Nome</label>
                <input
                  type="text"
                  value={plan.name}
                  onChange={(e) => handleChange(plan, "name", e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Preço mensal (R$)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={plan.price_month}
                  onChange={(e) => handleChange(plan, "price_month", Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Descrição</label>
                <input
                  type="text"
                  value={plan.description}
                  onChange={(e) => handleChange(plan, "description", e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">Limite de profissionais</label>
                <input
                  type="number"
                  min={0}
                  value={plan.max_providers ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleChange(plan, "max_providers", v === "" ? 999 : Number(v));
                  }}
                  placeholder="999 = ilimitado"
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                R$ {plan.price_month}/mês
                {plan.max_providers != null && plan.max_providers < 999 && (
                  <> · Até {plan.max_providers} profissionais</>
                )}
              </span>
              <button
                type="button"
                onClick={() => handleSave(plan)}
                disabled={savingId === plan.id}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
              >
                {savingId === plan.id ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
