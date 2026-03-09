"use client";

import { useEffect, useState } from "react";

type Metrics = {
  totalClinics: number;
  activeClinics: number;
  inactiveClinics: number;
  totalPatients: number;
  totalAppointmentsMonth: number;
  appointmentsPerDay: { date: string; count: number }[];
  topClinics: { id: string; name: string; count: number }[];
  mrrEstimated: number;
  churnCount: number;
  npsSimulated: number;
};

export default function MetricsView() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/metrics")
      .then((r) => r.json())
      .then((d) => {
        setMetrics({
          totalClinics: d.totalClinics ?? 0,
          activeClinics: d.activeClinics ?? 0,
          inactiveClinics: d.inactiveClinics ?? 0,
          totalPatients: d.totalPatients ?? 0,
          totalAppointmentsMonth: d.totalAppointmentsMonth ?? 0,
          appointmentsPerDay: d.appointmentsPerDay ?? [],
          topClinics: d.topClinics ?? [],
          mrrEstimated: d.mrrEstimated ?? 0,
          churnCount: d.churnCount ?? d.inactiveClinics ?? 0,
          npsSimulated: d.npsSimulated ?? 72,
        });
      })
      .catch(() => setMetrics(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Carregando métricas...
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
        Erro ao carregar métricas.
      </div>
    );
  }

  const maxCount = Math.max(
    1,
    ...metrics.appointmentsPerDay.map((d) => d.count),
  );

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Métricas</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">MRR estimado</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            R$ {(metrics.mrrEstimated ?? 0).toLocaleString("pt-BR")}
          </p>
          <p className="text-xs text-slate-400">{metrics.activeClinics ?? 0} clínicas ativas × R$ 297</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Churn do mês</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.churnCount ?? 0}</p>
          <p className="text-xs text-slate-400">clínicas desativadas</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">NPS simulado</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.npsSimulated ?? 72}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Total de pacientes</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.totalPatients}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Agendamentos (mês)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.totalAppointmentsMonth ?? 0}</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-medium text-slate-900">
          Agendamentos por dia (últimos 7 dias)
        </h2>
        <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-white p-6">
          {metrics.appointmentsPerDay.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full min-h-[4px] rounded bg-slate-300"
                style={{
                  height: `${Math.max(4, (d.count / maxCount) * 120)}px`,
                }}
                title={`${d.count} agendamentos`}
              />
              <span className="text-xs text-slate-500">
                {new Date(d.date).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                })}
              </span>
              <span className="text-xs font-medium text-slate-700">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-medium text-slate-900">Clínicas com mais agendamentos no mês</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left font-medium text-slate-500">Clínica</th>
                <th className="px-6 py-3 text-right font-medium text-slate-500">Agendamentos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {metrics.topClinics.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-4 text-slate-500">Nenhum dado</td>
                </tr>
              ) : (
                metrics.topClinics.map((c) => (
                  <tr key={c.id}>
                    <td className="px-6 py-3 font-medium text-slate-900">{c.name}</td>
                    <td className="px-6 py-3 text-right text-slate-600">{c.count}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
