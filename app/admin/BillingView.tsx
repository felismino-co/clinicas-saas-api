"use client";

import { useEffect, useState } from "react";

type Clinic = {
  id: string;
  name: string;
  phone: string | null;
  status: string;
  plan: string;
  plan_expires_at: string | null;
  created_at: string;
};

const PLAN_VALUES: Record<string, number> = {
  trial: 0,
  basico: 197,
  pro: 397,
  enterprise: 797,
};

export default function BillingView() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/clinics")
      .then((res) => res.json())
      .then((data) => setClinics(data.clinics ?? []))
      .catch(() => setClinics([]))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = clinics.filter((c) => c.status === "active").length;
  const trialCount = clinics.filter((c) => c.plan === "trial").length;
  const mrr = clinics.reduce((sum, c) => sum + (PLAN_VALUES[c.plan?.toLowerCase()] ?? 0), 0);

  if (loading) {
    return <p className="text-slate-500">Carregando...</p>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Faturamento</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">MRR total</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">R$ {mrr.toLocaleString("pt-BR")}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Clínicas ativas</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Em trial</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{trialCount}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Clínica</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Plano</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Próximo vencimento</th>
              <th className="px-4 py-3 text-left font-medium text-slate-500">Valor</th>
              <th className="px-4 py-3 text-right font-medium text-slate-500">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clinics.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                <td className="px-4 py-3 text-slate-600">{c.plan ?? "trial"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {c.status === "active" ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.plan_expires_at ? new Date(c.plan_expires_at).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  R$ {(PLAN_VALUES[c.plan?.toLowerCase()] ?? 0).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-indigo-600 hover:underline"
                    onClick={() => window.open(`/owner?clinic_id=${c.id}`, "_blank")}
                  >
                    Alterar plano
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
