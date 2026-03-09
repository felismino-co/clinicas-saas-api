import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  if (!clinicId) return badRequest("Parâmetro clinic_id é obrigatório.");

  try {
    const { data: clinicData, error: clinicError } = await supabase
      .from("clinics")
      .select("id, name, phone, email, completion_score, active, plan")
      .eq("id", clinicId)
      .maybeSingle();

    if (clinicError || !clinicData) {
      const { data: fallback } = await supabase
        .from("clinics")
        .select("id, name, phone, email")
        .eq("id", clinicId)
        .maybeSingle();
      if (!fallback) {
        return NextResponse.json(
          { error: "not_found", message: "Clínica não encontrada." },
          { status: 404 },
        );
      }
      const c = fallback as Record<string, unknown>;
      const hasPhone = !!(c.phone && String(c.phone).trim());
      const hasAddress = false;
      const hasBasicData = !!(c.name && c.email);
      const [
        { count: providersCount },
        { count: servicesCount },
        { data: whatsappRow },
        { data: aiRow },
        { data: usersRows },
        { count: appointmentsCount },
        { count: patientsCount },
      ] = await Promise.all([
        supabase.from("providers").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("services").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("clinic_whatsapp_config").select("id").eq("clinic_id", clinicId).maybeSingle(),
        supabase.from("clinic_ai_profiles").select("id").eq("clinic_id", clinicId).maybeSingle(),
        supabase.from("app_users").select("id, user_id, full_name, email, role, active").eq("clinic_id", clinicId),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      ]);
      const users = (usersRows ?? []).map((u: Record<string, unknown>) => ({
        id: u.id,
        user_id: u.user_id,
        full_name: u.full_name ?? null,
        email: u.email ?? null,
        role: u.role ?? "receptionist",
        active: u.active !== false,
      }));
      return NextResponse.json({
        clinic: {
          id: c.id,
          name: c.name ?? "",
          email: c.email ?? null,
          plan: (c.plan as string) ?? "trial",
          status: c.active === false ? "inactive" : "active",
          completion_score: 20,
        },
        checklist: {
          basic_data: hasBasicData,
          phone: hasPhone,
          address: hasAddress,
          professionals: (providersCount ?? 0) > 0,
          services: (servicesCount ?? 0) > 0,
          whatsapp: !!whatsappRow,
          ai: !!aiRow,
        },
        users,
        metrics: {
          appointmentsTotal: appointmentsCount ?? 0,
          patientsTotal: patientsCount ?? 0,
          whatsappConnected: !!whatsappRow,
        },
      });
    }

    const c = clinicData as Record<string, unknown>;
    const hasPhone = !!(c.phone && String(c.phone).trim());
    const hasAddress = !!(c.address != null && String(c.address).trim());
    const hasBasicData = !!(c.name && c.email);

    const [
      { count: providersCount },
      { count: servicesCount },
      { data: whatsappRow },
      { data: aiRow },
      { data: usersRows },
      { count: appointmentsCount },
      { count: patientsCount },
    ] = await Promise.all([
      supabase.from("providers").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("clinic_whatsapp_config").select("id").eq("clinic_id", clinicId).maybeSingle(),
      supabase.from("clinic_ai_profiles").select("id").eq("clinic_id", clinicId).maybeSingle(),
      supabase.from("app_users").select("id, user_id, full_name, email, role, active").eq("clinic_id", clinicId),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
    ]);

    const users = (usersRows ?? []).map((u: Record<string, unknown>) => ({
      id: u.id,
      user_id: u.user_id,
      full_name: u.full_name ?? null,
      email: u.email ?? null,
      role: u.role ?? "receptionist",
      active: u.active !== false,
    }));

    const completionScore = typeof c.completion_score === "number" ? c.completion_score : 20;
    const status = c.active === false ? "inactive" : "active";
    const plan = (c.plan as string) ?? "trial";
    const email = (c.email as string) ?? null;

    return NextResponse.json({
      clinic: {
        id: c.id,
        name: c.name ?? "",
        email,
        plan,
        status,
        completion_score: completionScore,
      },
      checklist: {
        basic_data: hasBasicData,
        phone: hasPhone,
        address: hasAddress,
        professionals: (providersCount ?? 0) > 0,
        services: (servicesCount ?? 0) > 0,
        whatsapp: !!whatsappRow,
        ai: !!aiRow,
      },
      users,
      metrics: {
        appointmentsTotal: appointmentsCount ?? 0,
        patientsTotal: patientsCount ?? 0,
        whatsappConnected: !!whatsappRow,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar detalhes." },
      { status: 500 },
    );
  }
}
