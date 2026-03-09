"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

type DashboardData = {
  revenue: number;
  monthlyGoal: number;
  returnRate: number;
  averageTicket: number;
  last7days: { date: string; total: number; confirmed: number }[];
  topServices: { id: string; name: string; count: number }[];
  trends: { revenue: number; appointments: number; returnRate: number };
  todayAppointments: number;
  weekAppointments: number;
  patientsTotal: number;
  confirmationRate: number;
  messagesToday: number;
  activeConversations: number;
  whatsappStatus: "connected" | "disconnected";
  appointmentsPerDay?: { date: string; count: number }[];
  topProviders?: { id: string; full_name: string; count: number }[];
  recentActivity?: { type: string; label: string; at: string }[];
};

type Props = {
  clinicId: string;
};

export default function DashboardView({ clinicId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [birthdayPatients, setBirthdayPatients] = useState<Array<{ id: string; full_name: string | null; phone: string | null; birth_date: string; age: number | null }>>([]);
  const [sendingBirthdays, setSendingBirthdays] = useState(false);

  const fetchBirthdays = () => {
    fetch(`/api/owner/birthdays?clinic_id=${encodeURIComponent(clinicId)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.patients) setBirthdayPatients(json.patients);
        else setBirthdayPatients([]);
      })
      .catch(() => setBirthdayPatients([]));
  };

  const fetchDashboard = () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    fetch(`/api/owner/dashboard-enhanced?clinic_id=${encodeURIComponent(clinicId)}&month=${month}&year=${year}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error || json.message) {
          setError(json.message || "Erro ao carregar dashboard.");
          setData(null);
          return;
        }
        setError(null);
        setData({
          revenue: Number(json.revenue) ?? 0,
          monthlyGoal: Number(json.monthlyGoal) ?? 10000,
          returnRate: Number(json.returnRate) ?? 0,
          averageTicket: Number(json.averageTicket) ?? 0,
          last7days: Array.isArray(json.last7days) ? json.last7days : [],
          topServices: Array.isArray(json.topServices) ? json.topServices : [],
          trends: json.trends && typeof json.trends === "object"
            ? {
                revenue: Number(json.trends.revenue) ?? 0,
                appointments: Number(json.trends.appointments) ?? 0,
                returnRate: Number(json.trends.returnRate) ?? 0,
              }
            : { revenue: 0, appointments: 0, returnRate: 0 },
          todayAppointments: Number(json.todayAppointments) ?? 0,
          weekAppointments: Number(json.weekAppointments) ?? 0,
          patientsTotal: Number(json.patientsTotal) ?? 0,
          confirmationRate: Number(json.confirmationRate) ?? 0,
          messagesToday: Number(json.messagesToday) ?? 0,
          activeConversations: Number(json.activeConversations) ?? 0,
          whatsappStatus: json.whatsappStatus === "disconnected" ? "disconnected" : "connected",
          appointmentsPerDay: json.appointmentsPerDay ?? json.last7days?.map((d: { date: string; total: number }) => ({ date: d.date, count: d.total })) ?? [],
          topProviders: json.topProviders ?? [],
          recentActivity: json.recentActivity ?? [],
        });
      })
      .catch(() => {
        setError("Erro ao carregar dashboard.");
        setData(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
    fetchBirthdays();
    intervalRef.current = setInterval(fetchDashboard, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [clinicId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        Carregando...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center text-sm text-rose-700">
        {error}
      </div>
    );
  }

  const d = data ?? {
    revenue: 0,
    monthlyGoal: 10000,
    returnRate: 0,
    averageTicket: 0,
    last7days: [] as { date: string; total: number; confirmed: number }[],
    topServices: [] as { id: string; name: string; count: number }[],
    trends: { revenue: 0, appointments: 0, returnRate: 0 },
    todayAppointments: 0,
    weekAppointments: 0,
    patientsTotal: 0,
    confirmationRate: 0,
    messagesToday: 0,
    activeConversations: 0,
    whatsappStatus: "connected" as const,
    appointmentsPerDay: [] as { date: string; count: number }[],
    topProviders: [] as { id: string; full_name: string; count: number }[],
    recentActivity: [] as { type: string; label: string; at: string }[],
  };

  const goalPct = d.monthlyGoal > 0 ? Math.min(100, Math.round((d.revenue / d.monthlyGoal) * 100)) : 0;
  const goalColor = goalPct >= 80 ? "bg-emerald-500" : goalPct >= 50 ? "bg-amber-500" : "bg-rose-500";

  const cards = [
    { label: "Receita do mês", value: `R$ ${d.revenue.toLocaleString("pt-BR")}`, icon: "💰", trend: d.trends.revenue },
    { label: "Meta mensal", value: `${goalPct}%`, icon: "🎯", goalPct, goalColor },
    { label: "Taxa de retorno", value: `${d.returnRate}%`, icon: "🔄", trend: d.trends.returnRate },
    { label: "Ticket médio", value: `R$ ${d.averageTicket.toLocaleString("pt-BR")}`, icon: "📊" },
    { label: "Agendamentos hoje", value: d.todayAppointments, icon: "📅" },
    { label: "Pacientes cadastrados", value: d.patientsTotal, icon: "👥" },
    { label: "Agendamentos da semana", value: d.weekAppointments, icon: "📆" },
    { label: "Taxa de confirmação (hoje)", value: `${d.confirmationRate}%`, icon: "✓" },
    {
      label: "Canal WhatsApp",
      value: d.whatsappStatus === "connected" ? "Conectado" : "Desconectado",
      icon: d.whatsappStatus === "connected" ? "🟢" : "🔴",
    },
    { label: "Mensagens recebidas hoje", value: d.messagesToday, icon: "💬" },
    { label: "Conversas ativas (IA)", value: d.activeConversations, icon: "🤖" },
  ];

  const last7 = d.last7days?.length ? d.last7days : d.appointmentsPerDay?.map((x) => ({ date: x.date, total: x.count, confirmed: 0 })) ?? [];
  const maxDay = Math.max(1, ...last7.map((x) => x.total));
  const topProviders = d.topProviders ?? [];
  const recentActivity = d.recentActivity ?? [];
  const topServices = d.topServices ?? [];
  const maxServiceCount = Math.max(1, ...topServices.map((s) => s.count));

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{card.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                  {"trend" in card && card.trend !== undefined && card.trend !== 0 && (
                    <span className={card.trend > 0 ? "text-emerald-600" : "text-rose-600"}>
                      {card.trend > 0 ? "↑" : "↓"} {Math.abs(card.trend)}%
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{card.label}</p>
                {"goalPct" in card && "goalColor" in card && (
                  <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${(card as { goalColor: string }).goalColor}`}
                      style={{ width: `${Math.min(100, (card as { goalPct: number }).goalPct)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {last7.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-slate-900">Últimos 7 dias</h2>
          <div className="flex items-end gap-2">
            {last7.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex gap-0.5 w-full justify-center items-end" style={{ minHeight: 80 }}>
                  <div
                    className="flex-1 min-w-0 rounded bg-slate-300"
                    style={{
                      height: `${Math.max(4, (day.total / maxDay) * 80)}px`,
                    }}
                    title={`Total: ${day.total}`}
                  />
                  <div
                    className="flex-1 min-w-0 rounded bg-emerald-500"
                    style={{
                      height: `${Math.max(4, (day.confirmed / maxDay) * 80)}px`,
                    }}
                    title={`Confirmados: ${day.confirmed}`}
                  />
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(day.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                </span>
                <span className="text-xs font-medium text-slate-700">{day.total} / {day.confirmed}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-slate-300" /> Total</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-emerald-500" /> Confirmados</span>
          </div>
        </div>
      )}

      {topServices.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-slate-900">Top 3 serviços</h2>
          <ul className="space-y-3">
            {topServices.map((s) => (
              <li key={s.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-900">{s.name}</span>
                  <span className="text-slate-500">{s.count} consultas</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(s.count / maxServiceCount) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentActivity.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-slate-900">Atividade recente</h2>
          <ul className="divide-y divide-slate-200">
            {recentActivity.map((a, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">{a.label}</span>
                <span className="text-slate-500">
                  {new Date(a.at).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Aniversariantes hoje
          {birthdayPatients.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-800">
              {birthdayPatients.length}
            </span>
          )}
        </h2>
        {birthdayPatients.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum aniversariante hoje 🎂</p>
        ) : (
          <>
            <ul className="mb-3 space-y-1 text-sm text-slate-700">
              {birthdayPatients.map((p) => (
                <li key={p.id}>
                  {p.full_name || "Sem nome"}
                  {p.age != null && p.age >= 0 && (
                    <span className="ml-1 text-slate-500">({p.age} anos)</span>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={async () => {
                setSendingBirthdays(true);
                try {
                  const res = await fetch(`/api/owner/birthdays?clinic_id=${encodeURIComponent(clinicId)}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ send_messages: true }),
                  });
                  const data = await res.json();
                  if (res.ok && data.sent !== undefined) {
                    fetchBirthdays();
                  }
                } finally {
                  setSendingBirthdays(false);
                }
              }}
              disabled={sendingBirthdays}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {sendingBirthdays ? "Enviando..." : "Enviar parabéns para todos"}
            </button>
          </>
        )}
      </div>

      {topProviders.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium text-slate-900">Top 5 profissionais (mês)</h2>
          <ul className="divide-y divide-slate-200">
            {topProviders.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <span className="font-medium text-slate-900">{p.full_name}</span>
                <span className="text-sm text-slate-500">{p.count} atendimentos</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => router.push("/secretary")}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Ver agenda completa
        </button>
      </div>
    </div>
  );
}
