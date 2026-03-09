import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  try {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, created_at")
      .eq("id", clinicId)
      .maybeSingle();

    if (!clinic) {
      return NextResponse.json({ error: "not_found", message: "Clínica não encontrada." }, { status: 404 });
    }

    const created = new Date((clinic as { created_at?: string }).created_at ?? Date.now());
    const now = new Date();
    const months: { month: number; year: number; label: string; start: string; end: string }[] = [];
    let y = created.getFullYear();
    let m = created.getMonth() + 1;
    const endY = now.getFullYear();
    const endM = now.getMonth() + 1;

    while (y < endY || (y === endY && m <= endM)) {
      const start = `${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`;
      const end = new Date(y, m, 0, 23, 59, 59, 999).toISOString();
      months.push({
        month: m,
        year: y,
        label: `${MONTH_NAMES[m - 1]} ${y}`,
        start,
        end,
      });
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    const { data: convs } = await supabase
      .from("conversations")
      .select("id")
      .eq("clinic_id", clinicId);
    const convIds = (convs ?? []).map((c: { id: string }) => c.id);

    const history: {
      month: number;
      year: number;
      label: string;
      conversations: number;
      appointments: number;
      conversionRate: number;
      avgResponseTime: number;
    }[] = [];

    for (const period of months) {
      let conversations = 0;
      let appointments = 0;
      let avgResponseTime = 0;

      const { count: convCount } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("created_at", period.start)
        .lte("created_at", period.end);
      conversations = convCount ?? 0;

      const { data: appts } = await supabase
        .from("appointments")
        .select("id")
        .eq("clinic_id", clinicId)
        .gte("starts_at", period.start)
        .lte("starts_at", period.end);
      appointments = (appts ?? []).length;

      if (convIds.length > 0) {
        const { data: messages } = await supabase
          .from("messages")
          .select("conversation_id, direction, created_at")
          .in("conversation_id", convIds)
          .gte("created_at", period.start)
          .lte("created_at", period.end)
          .order("created_at", { ascending: true });

        const byConv = new Map<string, Array<{ direction: string; created_at: string }>>();
        (messages ?? []).forEach((msg: { conversation_id: string; direction: string; created_at: string }) => {
          const list = byConv.get(msg.conversation_id) ?? [];
          list.push({ direction: msg.direction, created_at: msg.created_at });
          byConv.set(msg.conversation_id, list);
        });
        let sumMs = 0;
        let countResp = 0;
        byConv.forEach((list) => {
          for (let i = 0; i < list.length - 1; i++) {
            if (list[i].direction === "inbound" && list[i + 1].direction === "outbound") {
              const a = new Date(list[i].created_at).getTime();
              const b = new Date(list[i + 1].created_at).getTime();
              if (b > a) {
                sumMs += b - a;
                countResp++;
              }
            }
          }
        });
        avgResponseTime = countResp > 0 ? Math.round(sumMs / 1000 / countResp) : 0;
      }

      const conversionRate = conversations > 0 ? Math.round((appointments / conversations) * 100) : 0;

      history.push({
        month: period.month,
        year: period.year,
        label: period.label,
        conversations,
        appointments,
        conversionRate,
        avgResponseTime,
      });
    }

    return NextResponse.json({ history: history.reverse() });
  } catch (err) {
    console.error("bot-analytics/history error:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar histórico." },
      { status: 500 },
    );
  }
}
