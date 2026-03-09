import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: providerId } = await params;
  const url = new URL(request.url);
  const providerIdQuery = url.searchParams.get("provider_id");
  const effectiveId = providerId ?? providerIdQuery;

  if (!effectiveId) {
    return badRequest("provider_id é obrigatório.");
  }

  const { data, error } = await supabase
    .from("provider_schedules")
    .select("id, provider_id, clinic_id, day_of_week, start_time, end_time, is_active")
    .eq("provider_id", effectiveId)
    .eq("is_active", true)
    .order("day_of_week", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "database_error", message: error.message },
      { status: 500 },
    );
  }

  const schedules = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    provider_id: row.provider_id,
    clinic_id: row.clinic_id,
    day_of_week: row.day_of_week,
    start_time: typeof row.start_time === "string" ? row.start_time.slice(0, 8) : row.start_time,
    end_time: typeof row.end_time === "string" ? row.end_time.slice(0, 8) : row.end_time,
    is_active: row.is_active,
  }));

  return NextResponse.json({ schedules });
}

type ScheduleItem = { day_of_week: number; start_time: string; end_time: string };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: providerId } = await params;
  let body: { clinic_id: string; schedules: ScheduleItem[] };

  try {
    body = await request.json();
  } catch {
    return badRequest("Payload inválido.");
  }

  const { clinic_id, schedules } = body;
  if (!providerId || !clinic_id || !Array.isArray(schedules)) {
    return badRequest("provider_id, clinic_id e schedules são obrigatórios.");
  }

  const toInsert = schedules
    .filter((s) => Number(s.day_of_week) >= 0 && Number(s.day_of_week) <= 6)
    .map((s) => ({
      provider_id: providerId,
      clinic_id,
      day_of_week: Number(s.day_of_week),
      start_time: String(s.start_time).slice(0, 8),
      end_time: String(s.end_time).slice(0, 8),
      is_active: true,
    }));

  const { error: delError } = await supabase
    .from("provider_schedules")
    .delete()
    .eq("provider_id", providerId)
    .eq("clinic_id", clinic_id);

  if (delError) {
    return NextResponse.json(
      { error: "database_error", message: delError.message },
      { status: 500 },
    );
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("provider_schedules")
      .insert(toInsert as Record<string, unknown>[]);

    if (insertError) {
      return NextResponse.json(
        { error: "database_error", message: insertError.message },
        { status: 500 },
      );
    }
  }

  const { data: updated } = await supabase
    .from("provider_schedules")
    .select("id, provider_id, clinic_id, day_of_week, start_time, end_time, is_active")
    .eq("provider_id", providerId)
    .order("day_of_week", { ascending: true });

  return NextResponse.json({
    schedules: (updated ?? []).map((row: Record<string, unknown>) => ({
      id: row.id,
      provider_id: row.provider_id,
      clinic_id: row.clinic_id,
      day_of_week: row.day_of_week,
      start_time: typeof row.start_time === "string" ? row.start_time.slice(0, 8) : row.start_time,
      end_time: typeof row.end_time === "string" ? row.end_time.slice(0, 8) : row.end_time,
      is_active: row.is_active,
    })),
  });
}
