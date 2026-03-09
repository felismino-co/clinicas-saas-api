"use client";

import { useEffect, useState } from "react";

type DayStats = {
  total: number;
  confirmed: number;
  cancelled: number;
  no_show: number;
};

type NextAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  patient_name: string;
  patient_phone: string;
  provider_name: string;
  service_name: string;
};

type ReportsData = {
  date: string;
  dayStats: DayStats;
  weekTotal: number;
  patientsInMonth: number;
  nextAppointments: NextAppointment[];
};

type Props = {
  clinicId: string;
};

export default function ReportsView({ clinicId }: Props) {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setLoading(true);
    fetch(`/api/secretary/reports?clinic_id=${encodeURIComponent(clinicId)}&date=${selectedDate}`)
      .then((res) => res.json())
      .then((d) => {
        if (d.error) setData(null);
        else setData(d);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [clinicId, selectedDate]);

  const handleExportPdf = () => {
    alert("Em breve");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        Carregando relatórios...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center text-rose-700">
        Erro ao carregar relatórios.
      </div>
    );
  }

  const { dayStats, weekTotal, patientsInMonth, nextAppointments } = data;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-8 py-4">
        <h1 className="text-xl font-semibold text-slate-900">Relatórios</h1>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Data:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleExportPdf}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Exportar PDF
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Agendamentos do dia</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{dayStats.total}</p>
            <p className="mt-2 text-xs text-slate-600">
              Confirmados: {dayStats.confirmed} · Cancelados: {dayStats.cancelled} · No-show: {dayStats.no_show}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Agendamentos da semana</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{weekTotal}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">Pacientes atendidos no mês</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{patientsInMonth}</p>
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-lg font-medium text-slate-900">Próximos 5 agendamentos do dia</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {nextAppointments.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-slate-500">Nenhum agendamento no dia.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Horário</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Paciente</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Profissional</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Serviço</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {nextAppointments.map((a) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3 text-slate-700">
                        {new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {" – "}
                        {new Date(a.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">{a.patient_name}</td>
                      <td className="px-4 py-3">{a.provider_name}</td>
                      <td className="px-4 py-3">{a.service_name}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
