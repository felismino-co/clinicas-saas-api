import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export type ClinicSettings = {
  open_time?: string;
  close_time?: string;
  days_of_week?: number[];
};

const DEFAULT_SETTINGS: ClinicSettings = {
  open_time: "08:00",
  close_time: "18:00",
  days_of_week: [1, 2, 3, 4, 5],
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");

  if (!clinicId) return badRequest("Parâmetro 'clinic_id' é obrigatório.");

  try {
    const { data, error } = await supabase
      .from("clinics")
      .select("id, settings")
      .eq("id", clinicId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { settings: DEFAULT_SETTINGS },
        { status: 200 },
      );
    }

    const raw = (data as { settings?: ClinicSettings }).settings;
    const settings: ClinicSettings = {
      open_time: raw?.open_time ?? DEFAULT_SETTINGS.open_time,
      close_time: raw?.close_time ?? DEFAULT_SETTINGS.close_time,
      days_of_week: Array.isArray(raw?.days_of_week) ? raw.days_of_week : DEFAULT_SETTINGS.days_of_week,
    };
    return NextResponse.json({ settings }, { status: 200 });
  } catch {
    return NextResponse.json(
      { settings: DEFAULT_SETTINGS },
      { status: 200 },
    );
  }
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  if (!clinicId) return badRequest("Parâmetro 'clinic_id' é obrigatório.");

  let body: ClinicSettings;
  try {
    body = (await request.json()) as ClinicSettings;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const settings: ClinicSettings = {
    open_time: body.open_time ?? "08:00",
    close_time: body.close_time ?? "18:00",
    days_of_week: Array.isArray(body.days_of_week) ? body.days_of_week : [1, 2, 3, 4, 5],
  };

  try {
    const { error } = await supabase
      .from("clinics")
      .update({ settings } as Record<string, unknown>)
      .eq("id", clinicId);

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao salvar configurações." },
        { status: 500 },
      );
    }
    return NextResponse.json({ settings }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao salvar." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
