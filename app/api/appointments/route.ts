import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

type CreateAppointmentRequest = {
  clinic_id: string;
  patient_id: string;
  provider_id?: string | null;
  service_id?: string | null;
  starts_at: string;
  ends_at: string;
  source?: string;
  notes?: string | null;
};

const VALID_SOURCES = ["whatsapp", "phone", "manual", "campaign"];

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  let body: CreateAppointmentRequest;

  try {
    body = (await request.json()) as CreateAppointmentRequest;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const {
    clinic_id,
    patient_id,
    provider_id,
    service_id,
    starts_at,
    ends_at,
    source = "whatsapp",
    notes,
  } = body;

  if (!clinic_id || !patient_id || !starts_at || !ends_at) {
    return badRequest(
      "Campos obrigatórios: 'clinic_id', 'patient_id', 'starts_at', 'ends_at'.",
    );
  }

  if (!VALID_SOURCES.includes(source)) {
    return badRequest(
      `'source' deve ser um de: ${VALID_SOURCES.join(", ")}.`,
    );
  }

  const starts = new Date(starts_at);
  const ends = new Date(ends_at);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    return badRequest("'starts_at' e 'ends_at' devem ser datas válidas (ISO).");
  }
  if (ends <= starts) {
    return badRequest("'ends_at' deve ser posterior a 'starts_at'.");
  }

  try {
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patient_id)
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (!patient) {
      return NextResponse.json(
        {
          error: "patient_not_found",
          message: "Paciente não encontrado nesta clínica.",
        },
        { status: 404 },
      );
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert({
        clinic_id,
        patient_id,
        provider_id: provider_id ?? null,
        service_id: service_id ?? null,
        starts_at: starts_at,
        ends_at: ends_at,
        status: "scheduled",
        source,
        notes: notes ?? null,
      })
      .select("id, clinic_id, patient_id, provider_id, service_id, starts_at, ends_at, status")
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao criar agendamento:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao criar agendamento.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(appointment, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/appointments POST:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao criar o agendamento.",
      },
      { status: 500 },
    );
  }
}
