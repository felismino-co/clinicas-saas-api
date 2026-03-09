import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");

  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  const now = new Date();
  const m = month ? parseInt(month, 10) : now.getMonth() + 1;
  const y = year ? parseInt(year, 10) : now.getFullYear();
  const startThis = `${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`;
  const endThis = new Date(y, m, 0, 23, 59, 59, 999).toISOString();

  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const startPrev = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01T00:00:00.000Z`;
  const endPrev = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999).toISOString();

  const { data: convs } = await supabase
    .from("conversations")
    .select("id")
    .eq("clinic_id", clinicId);

  const convIds = (convs ?? []).map((c: { id: string }) => c.id);

  let avgResponseSeconds = 0;
  let totalConversations = 0;
  let conversionRate = 0;
  const peakByHour = new Array(24).fill(0);
  let appointmentsViaBot = 0;
  let conversationsThisMonth = 0;
  let conversationsPrevMonth = 0;
  let appointmentsThisMonth = 0;
  let appointmentsPrevMonth = 0;
  let conversionThis = 0;
  let conversionPrev = 0;

  if (convIds.length > 0) {
    const { data: messages } = await supabase
      .from("messages")
      .select("id, conversation_id, direction, created_at")
      .in("conversation_id", convIds)
      .gte("created_at", startThis)
      .lte("created_at", endThis)
      .order("created_at", { ascending: true });

    const byConv = new Map<string, Array<{ direction: string; created_at: string }>>();
    (messages ?? []).forEach((msg: { conversation_id: string; direction: string; created_at: string }) => {
      const list = byConv.get(msg.conversation_id) ?? [];
      list.push({ direction: msg.direction, created_at: msg.created_at });
      byConv.set(msg.conversation_id, list);
    });

    let sumResponseMs = 0;
    let countResponse = 0;
    byConv.forEach((list) => {
      for (let i = 0; i < list.length - 1; i++) {
        if (list[i].direction === "inbound" && list[i + 1].direction === "outbound") {
          const a = new Date(list[i].created_at).getTime();
          const b = new Date(list[i + 1].created_at).getTime();
          if (b > a) {
            sumResponseMs += b - a;
            countResponse++;
          }
        }
      }
    });
    avgResponseSeconds = countResponse > 0 ? Math.round(sumResponseMs / 1000 / countResponse) : 0;

    (messages ?? []).forEach((msg: { created_at: string }) => {
      const hour = new Date(msg.created_at).getUTCHours();
      if (hour >= 0 && hour < 24) peakByHour[hour]++;
    });
  }

  const { count: countThis } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", startThis)
    .lte("created_at", endThis);

  const { count: countPrev } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .gte("created_at", startPrev)
    .lte("created_at", endPrev);

  conversationsThisMonth = countThis ?? 0;
  conversationsPrevMonth = countPrev ?? 0;

  const { data: appThis } = await supabase
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinicId)
    .or("source.eq.whatsapp,source.eq.bot")
    .gte("starts_at", startThis)
    .lte("starts_at", endThis);

  const { data: appPrev } = await supabase
    .from("appointments")
    .select("id")
    .eq("clinic_id", clinicId)
    .or("source.eq.whatsapp,source.eq.bot")
    .gte("starts_at", startPrev)
    .lte("starts_at", endPrev);

  appointmentsThisMonth = (appThis ?? []).length;
  appointmentsPrevMonth = (appPrev ?? []).length;
  appointmentsViaBot = appointmentsThisMonth;

  totalConversations = conversationsThisMonth;
  conversionThis = totalConversations > 0 ? Math.round((appointmentsThisMonth / totalConversations) * 100) : 0;
  conversionPrev = conversationsPrevMonth > 0 ? Math.round((appointmentsPrevMonth / conversationsPrevMonth) * 100) : 0;
  conversionRate = conversionThis;

  return NextResponse.json({
    avgResponseSeconds,
    conversionRate: conversionThis,
    totalConversations: conversationsThisMonth,
    appointmentsViaBot,
    peakByHour,
    compare: {
      thisMonth: { conversations: conversationsThisMonth, appointments: appointmentsThisMonth, conversionRate: conversionThis },
      prevMonth: { conversations: conversationsPrevMonth, appointments: appointmentsPrevMonth, conversionRate: conversionPrev },
    },
    month: m,
    year: y,
  });
}
