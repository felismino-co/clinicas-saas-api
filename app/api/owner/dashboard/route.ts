import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");

  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  try {
    const today = new Date().toISOString().slice(0, 10);
    const startOfToday = `${today}T00:00:00.000Z`;
    const endOfToday = `${today}T23:59:59.999Z`;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfWeek = weekAgo.toISOString();

    const { data: clinicConversations } = await supabase
      .from("conversations")
      .select("id")
      .eq("clinic_id", clinicId);
    const conversationIds = (clinicConversations ?? []).map((c: { id: string }) => c.id);

    const [
      todayRes,
      weekRes,
      patientsRes,
      todayConfirmedRes,
      conversationsRes,
    ] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("starts_at", startOfToday)
        .lte("starts_at", endOfToday),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("starts_at", startOfWeek),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "confirmed")
        .gte("starts_at", startOfToday)
        .lte("starts_at", endOfToday),
      supabase
        .from("conversations")
        .select("id, needs_human, status")
        .eq("clinic_id", clinicId),
    ]);

    let messagesToday = 0;
    if (conversationIds.length > 0) {
      const { count: messagesCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .gte("created_at", startOfToday)
        .lte("created_at", endOfToday);
      messagesToday = messagesCount ?? 0;
    }

    const todayTotal = todayRes.count ?? 0;
    const weekTotal = weekRes.count ?? 0;
    const patientsTotal = patientsRes.count ?? 0;
    const todayConfirmed = todayConfirmedRes.count ?? 0;
    const confirmationRate = todayTotal > 0 ? Math.round((todayConfirmed / todayTotal) * 100) : 0;
    const conversations = (conversationsRes.data ?? []) as Array<{ needs_human?: boolean; status?: string }>;
    const activeConversations = conversations.filter(
      (c) => c.needs_human === false && c.status === "open",
    ).length;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const isoFrom = sevenDaysAgo.toISOString();

    const { data: appointmentsByDay } = await supabase
      .from("appointments")
      .select("id, starts_at, provider_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", isoFrom);

    const byDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = 0;
    }
    (appointmentsByDay ?? []).forEach((a: { starts_at: string }) => {
      const key = a.starts_at.slice(0, 10);
      if (byDay[key] !== undefined) byDay[key]++;
    });
    const appointmentsPerDay = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { data: monthAppointments } = await supabase
      .from("appointments")
      .select("provider_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", startOfMonth.toISOString());

    const providerCount: Record<string, number> = {};
    (monthAppointments ?? []).forEach((a: { provider_id: string | null }) => {
      const id = a.provider_id ?? "_sem_";
      providerCount[id] = (providerCount[id] ?? 0) + 1;
    });
    const topProviderIds = Object.entries(providerCount)
      .filter(([id]) => id !== "_sem_")
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    let topProviders: { id: string; full_name: string; count: number }[] = [];
    if (topProviderIds.length > 0) {
      const { data: providers } = await supabase
        .from("providers")
        .select("id, full_name")
        .in("id", topProviderIds);
      const byId = (providers ?? []).reduce((acc: Record<string, string>, p: { id: string; full_name: string | null }) => {
        acc[p.id] = p.full_name ?? "Sem nome";
        return acc;
      }, {});
      topProviders = topProviderIds.map((id) => ({
        id,
        full_name: byId[id] ?? id,
        count: providerCount[id] ?? 0,
      }));
    }

    const { data: recentAppointments } = await supabase
      .from("appointments")
      .select("id, starts_at, status, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(5);

    let recentMessages: Array<{ created_at: string; direction: string }> = [];
    if (conversationIds.length > 0) {
      const { data: msgData } = await supabase
        .from("messages")
        .select("id, direction, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(5);
      recentMessages = (msgData ?? []) as Array<{ created_at: string; direction: string }>;
    }

    type ActivityItem = { type: string; label: string; at: string };
    const appList = (recentAppointments ?? []) as Array<{ created_at: string; status: string }>;
    const msgList = (recentMessages ?? []) as Array<{ created_at: string; direction: string }>;
    const activities: ActivityItem[] = [
      ...appList.map((a) => ({ type: "appointment" as const, label: `Agendamento ${a.status}`, at: a.created_at })),
      ...msgList.map((m) => ({
        type: "message" as const,
        label: m.direction === "inbound" ? "Mensagem recebida" : "Mensagem enviada",
        at: m.created_at,
      })),
    ];
    const recentActivity = activities
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 5);

    return NextResponse.json(
      {
        todayAppointments: Number(todayTotal),
        weekAppointments: Number(weekTotal),
        patientsTotal: Number(patientsTotal),
        confirmationRate: Number(confirmationRate),
        messagesToday: Number(messagesToday),
        activeConversations: Number(activeConversations),
        whatsappStatus: "connected" as const,
        appointmentsPerDay,
        topProviders,
        recentActivity,
      },
      { status: 200 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro em /api/owner/dashboard:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar dashboard." },
      { status: 500 },
    );
  }
}
