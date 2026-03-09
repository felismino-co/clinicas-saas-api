import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

const DEFAULT_OPEN = "08:00";
const DEFAULT_CLOSE = "18:00";
const SLOT_MINUTES = 30;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const providerId = url.searchParams.get("provider_id");
  const dateParam = url.searchParams.get("date");

  if (!clinicId || !dateParam) {
    return badRequest("Parâmetros clinic_id e date são obrigatórios.");
  }

  const date = dateParam.slice(0, 10);
  const dayOfWeek = new Date(date + "T12:00:00").getDay();

  try {
    let openTime = DEFAULT_OPEN;
    let closeTime = DEFAULT_CLOSE;
    let slots: { starts_at: string; ends_at: string }[] = [];

    if (providerId) {
      const { data: blocks } = await supabase
        .from("provider_blocks")
        .select("id")
        .eq("provider_id", providerId)
        .eq("blocked_date", date)
        .limit(1);

      if (blocks && blocks.length > 0) {
        return NextResponse.json({ slots: [] }, { status: 200 });
      }

      const { data: schedules } = await supabase
        .from("provider_schedules")
        .select("day_of_week, start_time, end_time")
        .eq("provider_id", providerId)
        .eq("is_active", true);

      const daySchedules = (schedules ?? []).filter(
        (s: { day_of_week: number }) => Number(s.day_of_week) === dayOfWeek,
      );

      if (daySchedules.length === 0) {
        return NextResponse.json({ slots: [] }, { status: 200 });
      }

      for (const sch of daySchedules as { start_time: string; end_time: string }[]) {
        const startStr = String(sch.start_time).slice(0, 8);
        const endStr = String(sch.end_time).slice(0, 8);
        const [openH, openM] = startStr.split(":").map(Number);
        const [closeH, closeM] = endStr.split(":").map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        for (let min = openMinutes; min + SLOT_MINUTES <= closeMinutes; min += SLOT_MINUTES) {
          const h = Math.floor(min / 60);
          const m = min % 60;
          const hEnd = Math.floor((min + SLOT_MINUTES) / 60);
          const mEnd = (min + SLOT_MINUTES) % 60;
          const startStrSlot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const endStrSlot = `${String(hEnd).padStart(2, "0")}:${String(mEnd).padStart(2, "0")}`;
          slots.push({
            starts_at: `${date}T${startStrSlot}:00.000Z`,
            ends_at: `${date}T${endStrSlot}:00.000Z`,
          });
        }
      }
    } else {
      const { data: clinicData } = await supabase
        .from("clinics")
        .select("settings")
        .eq("id", clinicId)
        .maybeSingle();

      const settings = (clinicData as { settings?: { open_time?: string; close_time?: string; days_of_week?: number[] } } | null)?.settings;
      openTime = settings?.open_time ?? DEFAULT_OPEN;
      closeTime = settings?.close_time ?? DEFAULT_CLOSE;
      const daysOfWeek = Array.isArray(settings?.days_of_week) ? settings.days_of_week : [1, 2, 3, 4, 5];

      if (!daysOfWeek.includes(dayOfWeek)) {
        return NextResponse.json({ slots: [] }, { status: 200 });
      }

      const [openH, openM] = openTime.split(":").map(Number);
      const [closeH, closeM] = closeTime.split(":").map(Number);
      const openMinutes = openH * 60 + openM;
      const closeMinutes = closeH * 60 + closeM;

      for (let min = openMinutes; min + SLOT_MINUTES <= closeMinutes; min += SLOT_MINUTES) {
        const h = Math.floor(min / 60);
        const m = min % 60;
        const hEnd = Math.floor((min + SLOT_MINUTES) / 60);
        const mEnd = (min + SLOT_MINUTES) % 60;
        const startStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const endStr = `${String(hEnd).padStart(2, "0")}:${String(mEnd).padStart(2, "0")}`;
        slots.push({
          starts_at: `${date}T${startStr}:00.000Z`,
          ends_at: `${date}T${endStr}:00.000Z`,
        });
      }
    }

    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    let query = supabase
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("clinic_id", clinicId)
      .gte("starts_at", startOfDay)
      .lte("starts_at", endOfDay)
      .neq("status", "cancelled");

    if (providerId) {
      query = query.eq("provider_id", providerId);
    }

    const { data: appointments } = await query;

    const taken = new Set<string>();
    (appointments ?? []).forEach((a: { starts_at: string; ends_at: string }) => {
      taken.add(a.starts_at);
    });

    const available = slots.filter((s) => !taken.has(s.starts_at));

    return NextResponse.json({ slots: available }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar horários." },
      { status: 500 },
    );
  }
}
