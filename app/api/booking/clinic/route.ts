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
  const slug = url.searchParams.get("slug");
  if (!slug?.trim()) return badRequest("Parâmetro slug é obrigatório.");

  try {
    const { data: clinic, error: clinicErr } = await supabase
      .from("clinics")
      .select("id, name, slug, logo_url")
      .eq("slug", slug.trim().toLowerCase())
      .maybeSingle();

    if (clinicErr || !clinic) {
      return NextResponse.json(
        { error: "not_found", message: "Clínica não encontrada." },
        { status: 404 },
      );
    }

    const clinicId = (clinic as { id: string }).id;

    const [providersRes, servicesRes] = await Promise.all([
      supabase
        .from("providers")
        .select("id, full_name, specialty")
        .eq("clinic_id", clinicId)
        .order("full_name", { ascending: true }),
      supabase
        .from("services")
        .select("id, name, duration_minutes, price")
        .eq("clinic_id", clinicId)
        .order("name", { ascending: true }),
    ]);

    const providers = (providersRes.data ?? []).map((p: Record<string, unknown>) => ({
      id: p.id,
      full_name: p.full_name ?? "",
      specialty: p.specialty ?? null,
    }));
    const services = (servicesRes.data ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      name: s.name ?? "",
      duration_minutes: s.duration_minutes ?? null,
      price: s.price ?? null,
    }));

    return NextResponse.json(
      {
        clinic: {
          id: (clinic as { id: string }).id,
          name: (clinic as { name: string }).name ?? "",
          logo_url: (clinic as { logo_url?: string }).logo_url ?? null,
        },
        providers,
        services,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar clínica." },
      { status: 500 },
    );
  }
}
