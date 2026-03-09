"use client";

import { useEffect, useState } from "react";

type ProviderRow = {
  provider_id: string;
  name: string;
  specialty: string | null;
  appointments_count: number;
  revenue: number;
  commission: number;
  rule_type?: string | null;
  rule_value?: number | null;
};

type Props = { clinicId: string; showToast?: (message: string, type: "success" | "error" | "info") => void };

export default function CommissionsView({ clinicId, showToast }: Props) {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [month, setMonth] = useState(() => String(new Date().getMonth() + 1));
  const [year, setYear] = useState(() => String(new Date().getFullYear()));
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ruleType, setRuleType] = useState<Record<string, "percentage" | "fixed">>({});
  const [ruleValue, setRuleValue] = useState<Record<string, string>>({});

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/owner/commissions?clinic_id=${encodeURIComponent(clinicId)}&month=${month}&year=${year}`,
      );
      const data = await res.json();
      if (res.ok) {
        setProviders(data.providers ?? []);
        const rt: Record<string, "percentage" | "fixed"> = {};
        const rv: Record<string, string> = {};
        (data.providers ?? []).forEach((p: ProviderRow) => {
          rt[p.provider_id] = (p.rule_type === "fixed" ? "fixed" : "percentage") as "percentage" | "fixed";
          rv[p.provider_id] = p.rule_value != null ? String(p.rule_value) : "";
        });
        setRuleType(rt);
        setRuleValue(rv);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clinicId) fetchCommissions();
  }, [clinicId, month, year]);

  const saveRule = async (providerId: string) => {
    const type = ruleType[providerId] ?? "percentage";
    const val = parseFloat(ruleValue[providerId] ?? "0");
    if (Number.isNaN(val) || (type === "percentage" && (val < 0 || val > 100)) || (type === "fixed" && val < 0)) {
      showToast?.("Valor inválido.", "error");
      return;
    }
    setSavingId(providerId);
    try {
      const res = await fetch("/api/owner/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_id: clinicId,
          provider_id: providerId,
          type,
          value: val,
        }),
      });
      if (res.ok) {
        showToast?.("Regra salva.", "success");
        fetchCommissions();
      } else {
        const data = await res.json();
        showToast?.(data?.message ?? "Erro ao salvar.", "error");
      }
    } finally {
      setSavingId(null);
    }
  };

  const totalCommission = providers.reduce((acc, p) => acc + p.commission, 0);
  const maxConsultas = Math.max(1, ...providers.map((p) => p.appointments_count));

  const exportCsv = () => {
    const params = new URLSearchParams({ clinic_id: clinicId, month, year });
    window.open(`/api/owner/commissions/export?${params.toString()}`, "_blank");
    showToast?.("Download iniciado.", "success");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-900">Comissões</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" })}
              </option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Regras de comissão</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            {providers.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhum profissional.</p>
            ) : (
              providers.map((p) => (
                <div key={p.provider_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 p-3">
                  <span className="font-medium text-slate-800">{p.name}</span>
                  <select
                    value={ruleType[p.provider_id] ?? "percentage"}
                    onChange={(e) => setRuleType((prev) => ({ ...prev, [p.provider_id]: e.target.value as "percentage" | "fixed" }))}
                    className="rounded border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="percentage">%</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={ruleType[p.provider_id] === "percentage" ? 100 : undefined}
                    step={ruleType[p.provider_id] === "percentage" ? 1 : 0.01}
                    value={ruleValue[p.provider_id] ?? ""}
                    onChange={(e) => setRuleValue((prev) => ({ ...prev, [p.provider_id]: e.target.value }))}
                    placeholder={ruleType[p.provider_id] === "percentage" ? "0-100" : "0.00"}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => saveRule(p.provider_id)}
                    disabled={savingId === p.provider_id}
                    className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingId === p.provider_id ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Relatório de comissões</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando...</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Médico</th>
                    <th className="px-4 py-3">Consultas</th>
                    <th className="px-4 py-3">Receita total</th>
                    <th className="px-4 py-3">Comissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {providers.map((p) => (
                    <tr key={p.provider_id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                      <td className="px-4 py-3 text-slate-600">{p.appointments_count}</td>
                      <td className="px-4 py-3 text-slate-600">R$ {p.revenue.toFixed(2)}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">R$ {p.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-800">
              Total pago em comissões no período: R$ {totalCommission.toFixed(2)}
            </div>
          </>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Ranking de médicos</h3>
        <div className="space-y-2">
          {providers.slice().sort((a, b) => b.appointments_count - a.appointments_count).slice(0, 10).map((p, i) => (
            <div key={p.provider_id} className="flex items-center gap-3">
              <span className="w-6 text-xs font-medium text-slate-500">{i + 1}º</span>
              <span className="w-40 truncate text-sm text-slate-800">{p.name}</span>
              <div className="flex-1 h-6 rounded bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded bg-indigo-500"
                  style={{ width: `${(p.appointments_count / maxConsultas) * 100}%` }}
                />
              </div>
              <span className="text-xs text-slate-600">{p.appointments_count} consultas</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Por consultas realizadas no período</p>
      </section>
    </div>
  );
}
