import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

type CreatePatientRequest = {
  clinic_id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  birth_date?: string | null;
  document?: string | null;
  tags?: string[] | Record<string, unknown> | null;
};

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  let body: CreatePatientRequest;

  try {
    body = (await request.json()) as CreatePatientRequest;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const {
    clinic_id,
    full_name,
    phone,
    email = null,
    birth_date = null,
    document = null,
    tags = null,
  } = body;

  if (!clinic_id || !phone) {
    return badRequest("Campos 'clinic_id' e 'phone' são obrigatórios.");
  }

  const name = typeof full_name === "string" ? full_name.trim() : "";
  const phoneNormalized = typeof phone === "string" ? phone.trim() : "";

  if (!phoneNormalized) {
    return badRequest("Campo 'phone' não pode ser vazio.");
  }

  try {
    const { data: existing } = await supabase
      .from("patients")
      .select("id")
      .eq("clinic_id", clinic_id)
      .eq("phone", phoneNormalized)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          error: "conflict",
          message: "Já existe um paciente com este telefone nesta clínica.",
          patient_id: existing.id,
        },
        { status: 409 },
      );
    }

    const { data: patient, error } = await supabase
      .from("patients")
      .insert({
        clinic_id,
        full_name: name || null,
        phone: phoneNormalized,
        email: email ?? null,
        birth_date: birth_date ?? null,
        document: document ?? null,
        tags: tags ?? null,
      })
      .select("id, clinic_id, full_name, phone, email, birth_date, document, tags, created_at")
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao criar paciente:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao criar paciente.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(patient, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/patients POST:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao criar o paciente.",
      },
      { status: 500 },
    );
  }
}
