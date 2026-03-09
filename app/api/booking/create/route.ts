import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

type Body = {
  clinic_id: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string;
  provider_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
};

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const {
    clinic_id,
    patient_name,
    patient_phone,
    patient_email,
    provider_id,
    service_id,
    starts_at,
    ends_at,
  } = body;

  if (!clinic_id || !patient_name?.trim() || !patient_phone?.trim() || !provider_id || !service_id || !starts_at || !ends_at) {
    return badRequest("Campos obrigatórios: clinic_id, patient_name, patient_phone, provider_id, service_id, starts_at, ends_at.");
  }

  try {
    let patientId: string | null = null;

    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinic_id)
      .eq("phone", patient_phone.trim())
      .limit(1)
      .maybeSingle();

    if (existing && (existing as { id: string }).id) {
      patientId = (existing as { id: string }).id;
    } else {
      const { data: newPatient, error: patientErr } = await supabase
        .from("patients")
        .insert({
          clinic_id,
          full_name: patient_name.trim(),
          phone: patient_phone.trim(),
          email: patient_email?.trim() || null,
        } as Record<string, unknown>)
        .select("id")
        .single();

      if (patientErr || !newPatient) {
        return NextResponse.json(
          { error: "database_error", message: "Falha ao cadastrar paciente." },
          { status: 500 },
        );
      }
      patientId = (newPatient as { id: string }).id;
    }

    const { data: appointment, error: appErr } = await supabase
      .from("appointments")
      .insert({
        clinic_id,
        patient_id: patientId,
        provider_id,
        service_id,
        starts_at,
        ends_at,
        status: "scheduled",
        source: "online",
      } as Record<string, unknown>)
      .select("id")
      .single();

    if (appErr || !appointment) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao criar agendamento." },
        { status: 500 },
      );
    }

    const appointmentId = (appointment as { id: string }).id;

    // CRM: buscar ou criar contact e atualizar status para scheduled/patient
    try {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("clinic_id", clinic_id)
        .eq("phone", patient_phone.trim())
        .limit(1)
        .maybeSingle();

      const { count: totalAppointments } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", patientId);

      const hadPreviousAppointment = (totalAppointments ?? 0) > 1;
      const contactStatus = hadPreviousAppointment ? "patient" : "scheduled";

      if (existingContact && (existingContact as { id: string }).id) {
        await supabase
          .from("contacts")
          .update({
            full_name: patient_name.trim(),
            patient_id: patientId,
            status: contactStatus,
            last_contact_at: new Date().toISOString(),
            is_first_time: false,
          } as Record<string, unknown>)
          .eq("id", (existingContact as { id: string }).id);
      } else {
        await supabase.from("contacts").insert({
          clinic_id,
          patient_id: patientId,
          phone: patient_phone.trim(),
          full_name: patient_name.trim(),
          status: contactStatus,
          source: "online",
          is_first_time: false,
        } as Record<string, unknown>);
      }
    } catch {
      // não falha o booking se a tabela contacts não existir
    }

    return NextResponse.json(
      { appointment_id: appointmentId, success: true },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao criar agendamento." },
      { status: 500 },
    );
  }
}
