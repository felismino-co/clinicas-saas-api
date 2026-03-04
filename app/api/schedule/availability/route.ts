import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type OpeningHours = Record<
  string,
  Array<{ from: string; to: string }> | undefined
>;

const CANCELLED = "cancelled";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

/**
 * Gera slots de disponibilidade para um dia, descontando horários já ocupados.
 * opening_hours: { mon: [{ from: "08:00", to: "18:00" }], ... }
 * timezoneOffset: offset em horas para o dia (ex: -3 para BRT)
 */
function buildSlots(
  date: string,
  openingHours: OpeningHours,
  durationMinutes: number,
  occupied: Array<{ starts_at: string; ends_at: string }>,
  timezoneOffsetHours = -3,
): Array<{ starts_at: string; ends_at: string }> {
  const d = new Date(date + "T12:00:00.000Z");
  const dayIndex = d.getUTCDay();
  const dayKey = DAY_KEYS[dayIndex];
  const intervals = openingHours[dayKey];
  if (!intervals?.length) return [];

  const slots: Array<{ starts_at: string; ends_at: string }> = [];
  const pad = (n: number) => String(n).padStart(2, "0");

  for (const { from, to } of intervals) {
    const [fromH, fromM] = from.split(":").map(Number);
    const [toH, toM] = to.split(":").map(Number);
    let minutesStart = fromH * 60 + fromM;
    const minutesEnd = toH * 60 + toM;

    while (minutesStart + durationMinutes <= minutesEnd) {
      const endMinutes = minutesStart + durationMinutes;
      const startH = Math.floor(minutesStart / 60);
      const startM = minutesStart % 60;
      const endH = Math.floor(endMinutes / 60);
      const endM = endMinutes % 60;
      const startTime = `${pad(startH)}:${pad(startM)}:00`;
      const endTime = `${pad(endH)}:${pad(endM)}:00`;
      const offsetStr =
        timezoneOffsetHours >= 0
          ? `+${pad(timezoneOffsetHours)}:00`
          : `-${pad(-timezoneOffsetHours)}:00`;
      const startsAt = `${date}T${startTime}${offsetStr}`;
      const endsAt = `${date}T${endTime}${offsetStr}`;

      const overlaps = occupied.some(
        (o) =>
          new Date(startsAt) < new Date(o.ends_at) &&
          new Date(endsAt) > new Date(o.starts_at),
      );
      if (!overlaps) slots.push({ starts_at: startsAt, ends_at: endsAt });

      minutesStart += durationMinutes;
    }
  }

  return slots;
}

/**
 * Retorna início e fim do dia em UTC para o date no timezone da clínica (offset em horas).
 */
function dayBoundsUTC(date: string, timezoneOffsetHours: number) {
  const start = new Date(
    Date.UTC(
      new Date(date).getUTCFullYear(),
      new Date(date).getUTCMonth(),
      new Date(date).getUTCDate(),
      -timezoneOffsetHours,
      0,
      0,
      0,
    ),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const serviceId = url.searchParams.get("service_id");
  const date = url.searchParams.get("date");

  if (!clinicId || !serviceId || !date) {
    return badRequest(
      "Parâmetros 'clinic_id', 'service_id' e 'date' (YYYY-MM-DD) são obrigatórios.",
    );
  }

  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.exec(date);
  if (!dateMatch) {
    return badRequest("O parâmetro 'date' deve estar no formato YYYY-MM-DD.");
  }

  try {
    const [clinicRes, serviceRes] = await Promise.all([
      supabase
        .from("clinics")
        .select("id, opening_hours, timezone")
        .eq("id", clinicId)
        .maybeSingle(),
      supabase
        .from("services")
        .select("id, duration_minutes")
        .eq("id", serviceId)
        .eq("clinic_id", clinicId)
        .maybeSingle(),
    ]);

    if (clinicRes.error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao buscar clínica:", clinicRes.error);
      return NextResponse.json(
        { error: "database_error", message: "Falha ao buscar clínica." },
        { status: 500 },
      );
    }
    if (serviceRes.error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao buscar serviço:", serviceRes.error);
      return NextResponse.json(
        { error: "database_error", message: "Falha ao buscar serviço." },
        { status: 500 },
      );
    }

    const clinic = clinicRes.data as { id: string; opening_hours: OpeningHours | null; timezone: string | null } | null;
    const service = serviceRes.data as { id: string; duration_minutes: number } | null;

    if (!clinic) {
      return NextResponse.json(
        { error: "clinic_not_found", message: "Clínica não encontrada." },
        { status: 404 },
      );
    }
    if (!service) {
      return NextResponse.json(
        { error: "service_not_found", message: "Serviço não encontrado para esta clínica." },
        { status: 404 },
      );
    }

    const openingHours = (clinic.opening_hours ?? {}) as OpeningHours;
    const durationMinutes = service.duration_minutes ?? 30;
    const tzOffset = clinic.timezone?.includes("Sao_Paulo") ? -3 : -3;

    const { from, to } = dayBoundsUTC(date, tzOffset);

    const { data: appointments, error: appError } = await supabase
      .from("appointments")
      .select("starts_at, ends_at")
      .eq("clinic_id", clinicId)
      .neq("status", CANCELLED)
      .gte("starts_at", from)
      .lt("starts_at", to);

    if (appError) {
      // eslint-disable-next-line no-console
      console.error("Erro ao buscar agendamentos:", appError);
      return NextResponse.json(
        { error: "database_error", message: "Falha ao buscar agendamentos." },
        { status: 500 },
      );
    }

    const occupied = (appointments ?? []).map((a) => ({
      starts_at: a.starts_at,
      ends_at: a.ends_at,
    }));

    const slots = buildSlots(
      date,
      openingHours,
      durationMinutes,
      occupied,
      tzOffset,
    );

    return NextResponse.json(
      {
        clinic_id: clinicId,
        service_id: serviceId,
        date,
        slots,
      },
      { status: 200 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/schedule/availability:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao buscar disponibilidade.",
      },
      { status: 500 },
    );
  }
}
