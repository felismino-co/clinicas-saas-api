import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");

  if (!id || !clinicId) {
    return NextResponse.json(
      { error: "bad_request", message: "Parâmetros 'id' e 'clinic_id' são obrigatórios." },
      { status: 400 },
    );
  }

  try {
    const { data: patientData, error: patientErr } = await supabase
      .from("patients")
      .select("id, clinic_id, full_name, phone, email, tags, created_at, blocked, birth_date")
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (patientErr) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao buscar paciente." },
        { status: 500 },
      );
    }

    if (!patientData) {
      return NextResponse.json(
        { error: "not_found", message: "Paciente não encontrado." },
        { status: 404 },
      );
    }

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status")
      .eq("clinic_id", clinicId)
      .eq("patient_id", id)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: false });

    const list = (appointments ?? []) as Array<{ starts_at: string }>;
    const totalConsultas = list.length;
    const ultimaConsulta = list[0]?.starts_at ?? null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const computedTags: string[] = [];
    const created = (patientData as { created_at?: string }).created_at;
    if (created && new Date(created) >= thirtyDaysAgo) computedTags.push("novo");
    if (totalConsultas >= 5) computedTags.push("vip");
    else if (totalConsultas >= 3) computedTags.push("recorrente");
    if (!ultimaConsulta || new Date(ultimaConsulta) < ninetyDaysAgo) computedTags.push("inativo");

    const patient = {
      ...patientData,
      appointments_count: totalConsultas,
      last_appointment_at: ultimaConsulta,
      computed_tags: computedTags,
    };

    return NextResponse.json({ patient }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro em /api/patients/[id] GET:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Ocorreu um erro inesperado." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");

  if (!id || !clinicId) {
    return NextResponse.json(
      { error: "bad_request", message: "Parâmetros 'id' e 'clinic_id' são obrigatórios." },
      { status: 400 },
    );
  }

  let body: { blocked?: boolean };
  try {
    body = (await request.json()) as { blocked?: boolean };
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload JSON inválido." },
      { status: 400 },
    );
  }

  if (typeof body.blocked !== "boolean") {
    return NextResponse.json(
      { error: "bad_request", message: "Campo 'blocked' (boolean) é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("patients")
      .update({ blocked: body.blocked } as Record<string, unknown>)
      .eq("id", id)
      .eq("clinic_id", clinicId)
      .select("id, blocked")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao atualizar paciente." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "not_found", message: "Paciente não encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json({ patient: data }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro em /api/patients/[id] PATCH:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Ocorreu um erro inesperado." },
      { status: 500 },
    );
  }
}
