import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

const DAY_LABELS: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  try {
    const [clinicRes, providersRes, servicesRes, aiRes] = await Promise.all([
      supabase.from("clinics").select("id, name, phone, address, settings").eq("id", clinicId).maybeSingle(),
      supabase.from("providers").select("id, full_name, specialty").eq("clinic_id", clinicId),
      supabase.from("services").select("id, name, duration_minutes, price, description").eq("clinic_id", clinicId),
      supabase.from("clinic_ai_profiles").select("assistant_name, tone, context, automations").eq("clinic_id", clinicId).eq("is_active", true).maybeSingle(),
    ]);

    const clinicRow = clinicRes.data as { id?: string; name?: string; phone?: string; address?: string; settings?: { open_time?: string; close_time?: string; days_of_week?: number[] } } | null;
    if (!clinicRow?.id) {
      return NextResponse.json({ error: "not_found", message: "Clínica não encontrada." }, { status: 404 });
    }

    const settings = clinicRow.settings ?? {};
    const daysOfWeek = Array.isArray(settings.days_of_week) ? settings.days_of_week : [1, 2, 3, 4, 5];
    const workingDays = daysOfWeek.map((d) => DAY_LABELS[d] ?? String(d)).join(", ");
    const start = settings.open_time ?? "08:00";
    const end = settings.close_time ?? "18:00";

    const clinic = {
      name: clinicRow.name ?? "Clínica",
      address: clinicRow.address ?? "",
      phone: clinicRow.phone ?? "",
      working_hours: { start, end },
      working_days: workingDays,
    };

    const providerIds = ((providersRes.data ?? []) as Array<{ id: string }>).map((p) => p.id);
    let schedules: Array<{ provider_id: string; day_of_week: number; start_time: string; end_time: string }> = [];
    if (providerIds.length > 0) {
      const { data: scheduleRows } = await supabase
        .from("provider_schedules")
        .select("provider_id, day_of_week, start_time, end_time")
        .in("provider_id", providerIds)
        .eq("is_active", true);
      schedules = (scheduleRows ?? []) as Array<{ provider_id: string; day_of_week: number; start_time: string; end_time: string }>;
    }

    const providers = ((providersRes.data ?? []) as Array<{ id: string; full_name: string | null; specialty: string | null }>).map((p) => {
      const provSchedules = schedules
        .filter((s) => s.provider_id === p.id)
        .map((s) => ({
          day: DAY_LABELS[s.day_of_week] ?? String(s.day_of_week),
          start: String(s.start_time).slice(0, 5),
          end: String(s.end_time).slice(0, 5),
        }));
      return {
        name: p.full_name ?? "Profissional",
        specialty: p.specialty ?? "",
        schedule: provSchedules,
      };
    });

    const services = ((servicesRes.data ?? []) as Array<{ name: string | null; duration_minutes?: number | null; price?: number | null }>).map((s) => ({
      name: s.name ?? "",
      duration: s.duration_minutes ?? 0,
      price: s.price ?? 0,
    }));

    const aiProfileRow = aiRes.data as { assistant_name?: string; tone?: string; context?: string; automations?: unknown } | null;
    const ai_profile = aiProfileRow
      ? {
          assistant_name: aiProfileRow.assistant_name ?? "Ana",
          tone: aiProfileRow.tone ?? "humanizado",
          context: aiProfileRow.context ?? "",
          automations: aiProfileRow.automations ?? {},
        }
      : { assistant_name: "Ana", tone: "humanizado", context: "", automations: {} };

    return NextResponse.json({
      clinic,
      providers,
      services,
      ai_profile,
    });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao montar contexto." },
      { status: 500 },
    );
  }
}
