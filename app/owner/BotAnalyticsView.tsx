"use client";

import { useEffect, useState } from "react";

type HistoryItem = {
  month: number;
  year: number;
  label: string;
  conversations: number;
  appointments: number;
  conversionRate: number;
  avgResponseTime: number;
};

type Analytics = {
  avgResponseSeconds: number;
  conversionRate: number;
  totalConversations: number;
  appointmentsViaBot: number;
  peakByHour: number[];
  compare: {
    thisMonth: { conversations: number; appointments: number; conversionRate: number };
    prevMonth: { conversations: number; appointments: number; conversionRate: number };
  };
  month: number;
  year: number;
};

type Props = { clinicId: string };

function formatResponseTime(seconds: number): string {
  if (seconds < 60) return `${seconds} seg`;
  const min = Math.floor(seconds / 60);
  const seg = seconds % 60;
  return seg > 0 ? `${min}min ${seg}seg` : `${min}min`;
}

export default function BotAnalyticsView({ clinicId }: Props) {
  const [data, setData] = useState<Analytics | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<string>("");

  useEffect(() => {
    setHistoryLoading(true);
    fetch(`/api/owner/bot-analytics/history?clinic_id=${encodeURIComponent(clinicId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.history && Array.isArray(json.history)) {
          setHistory(json.history);
          if (json.history.length > 0 && !selectedOption) {
            const first = json.history[0];
            setSelectedOption(`${first.year}-${first.month}`);
          }
        } else {
          setHistory([]);
        }
      })
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [clinicId]);

  const monthParam = selectedOption ? selectedOption.split("-")[1] : String(new Date().getMonth() + 1);
  const yearParam = selectedOption ? selectedOption.split("-")[0] : String(new Date().getFullYear());

  useEffect(() => {
    if (!selectedOption) return;
    setLoading(true);
    fetch(
      `/api/owner/bot-analytics?clinic_id=${encodeURIComponent(clinicId)}&month=${monthParam}&year=${yearParam}`,
    )
      .then((res) => res.json())
      .then((json) => {
        if (json.error) setData(null);
        else setData(json);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [clinicId, monthParam, yearParam, selectedOption]);

  if (historyLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        Carregando...
      </div>
    );
  }

  const peak = data?.peakByHour ?? Array(24).fill(0);
  const maxPeak = Math.max(1, ...peak);
  const maxConversion = Math.max(1, ...history.map((h) => h.conversionRate));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">Mês/Ano</label>
        <select
          value={selectedOption || (history[0] ? `${history[0].year}-${history[0].month}` : "")}
          onChange={(e) => setSelectedOption(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {history.length === 0 && (
            <option value="">Nenhum mês disponível</option>
          )}
          {history.map((h) => (
            <option key={`${h.year}-${h.month}`} value={`${h.year}-${h.month}`}>
              {h.label}
            </option>
          ))}
        </select>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-12 text-slate-500">Carregando métricas...</div>
      ) : data ? (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">
                {formatResponseTime(data.avgResponseSeconds)}
              </p>
              <p className="text-sm text-slate-500">Tempo médio de resposta</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">{data.conversionRate}%</p>
              <p className="text-sm text-slate-500">Taxa de conversão</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">{data.totalConversations}</p>
              <p className="text-sm text-slate-500">Conversas no mês</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-2xl font-bold text-slate-900">{data.appointmentsViaBot}</p>
              <p className="text-sm text-slate-500">Agendamentos via bot</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-slate-900">Evolução da taxa de conversão</h2>
            <div className="flex items-end gap-1 overflow-x-auto pb-2">
              {[...history].reverse().map((h) => (
                <div
                  key={`${h.year}-${h.month}`}
                  className="flex flex-1 min-w-[48px] flex-col items-center gap-1"
                  title={`${h.label}: ${h.conversionRate}%`}
                >
                  <div
                    className="w-full min-h-[4px] rounded bg-emerald-500"
                    style={{
                      height: `${Math.max(4, (h.conversionRate / maxConversion) * 120)}px`,
                    }}
                  />
                  <span className="text-xs text-slate-500 truncate max-w-full">
                    {h.label.split(" ")[0].slice(0, 3)} {String(h.year).slice(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-slate-900">Horários de pico (mensagens)</h2>
            <div className="flex items-end gap-1">
              {peak.map((count, hour) => (
                <div
                  key={hour}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${hour}h: ${count} msgs`}
                >
                  <div
                    className="w-full min-h-[4px] rounded bg-indigo-200"
                    style={{
                      height: `${Math.max(4, (count / maxPeak) * 80)}px`,
                    }}
                  />
                  <span className="text-xs text-slate-500">{hour}h</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm overflow-x-auto">
        <h2 className="mb-4 text-lg font-medium text-slate-900">Histórico completo</h2>
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left font-medium text-slate-700">Mês</th>
              <th className="py-2 text-right font-medium text-slate-700">Conversas</th>
              <th className="py-2 text-right font-medium text-slate-700">Agendamentos</th>
              <th className="py-2 text-right font-medium text-slate-700">Conversão</th>
              <th className="py-2 text-right font-medium text-slate-700">Tempo médio resp.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  Nenhum dado de histórico ainda.
                </td>
              </tr>
            ) : (
              history.map((h) => (
                <tr key={`${h.year}-${h.month}`}>
                  <td className="py-2 font-medium text-slate-900">{h.label}</td>
                  <td className="py-2 text-right text-slate-700">{h.conversations}</td>
                  <td className="py-2 text-right text-slate-700">{h.appointments}</td>
                  <td className="py-2 text-right text-slate-700">{h.conversionRate}%</td>
                  <td className="py-2 text-right text-slate-700">{formatResponseTime(h.avgResponseTime)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-slate-900">Comparativo mês a mês</h2>
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left font-medium text-slate-700">Métrica</th>
                <th className="py-2 text-right font-medium text-slate-700">
                  {new Date(data.year, data.month - 1).toLocaleString("pt-BR", { month: "long", year: "numeric" })}
                </th>
                <th className="py-2 text-right font-medium text-slate-700">Mês anterior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 text-slate-600">Conversas</td>
                <td className="py-2 text-right font-medium">{data.compare.thisMonth.conversations}</td>
                <td className="py-2 text-right text-slate-500">{data.compare.prevMonth.conversations}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">Agendamentos</td>
                <td className="py-2 text-right font-medium">{data.compare.thisMonth.appointments}</td>
                <td className="py-2 text-right text-slate-500">{data.compare.prevMonth.appointments}</td>
              </tr>
              <tr>
                <td className="py-2 text-slate-600">Taxa de conversão</td>
                <td className="py-2 text-right font-medium">{data.compare.thisMonth.conversionRate}%</td>
                <td className="py-2 text-right text-slate-500">{data.compare.prevMonth.conversionRate}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
