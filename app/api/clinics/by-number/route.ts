import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

type ClinicRow = {
  id: string;
  name: string;
  timezone: string | null;
  opening_hours: unknown | null;
  ai_template_id: string | null;
  ai_overrides: unknown | null;
};

type WhatsappChannelWithClinic = {
  id: string;
  phone_number: string;
  clinic: ClinicRow | null;
};

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const number = url.searchParams.get("number");

  if (!number) {
    return badRequest("Parâmetro de consulta 'number' é obrigatório.");
  }

  // Opcional: normalizar o número (remover espaços)
  const normalizedNumber = number.trim();

  try {
    // Log de entrada para depuração
    // eslint-disable-next-line no-console
    console.log(
      "[/api/clinics/by-number] Buscando clínica para número:",
      normalizedNumber,
    );

    const { data, error } = await supabase
      .from("whatsapp_channels")
      .select(
        `
        id,
        phone_number,
        clinic:clinics (
          id,
          name,
          timezone,
          opening_hours,
          ai_template_id,
          ai_overrides
        )
      `,
      )
      .eq("phone_number", normalizedNumber)
      .eq("active", true)
      .maybeSingle();

    // Logs detalhados do resultado da query
    // eslint-disable-next-line no-console
    console.log(
      "[/api/clinics/by-number] Resultado Supabase:",
      "error =",
      error,
      "data =",
      data,
    );

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao buscar clínica por número:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao buscar clínica para o número informado.",
        },
        { status: 500 },
      );
    }

    // Tratamento explícito para caso de nenhum registro encontrado
    if (!data) {
      // eslint-disable-next-line no-console
      console.warn(
        "[/api/clinics/by-number] Nenhum canal encontrado para número:",
        normalizedNumber,
      );
      return NextResponse.json(
        {
          error: "clinic_not_found",
          message: "Nenhuma clínica configurada para este número.",
        },
        { status: 404 },
      );
    }

    const row = data as WhatsappChannelWithClinic;

    if (!row.clinic) {
      // eslint-disable-next-line no-console
      console.warn(
        "[/api/clinics/by-number] Canal encontrado, mas relacionamento com clínica vazio:",
        row,
      );
      return NextResponse.json(
        {
          error: "clinic_not_found",
          message: "Canal encontrado, mas nenhuma clínica associada.",
        },
        { status: 404 },
      );
    }

    const clinic = row.clinic;

    const responseBody = {
      clinic_id: clinic.id,
      name: clinic.name,
      timezone: clinic.timezone ?? "America/Sao_Paulo",
      opening_hours: clinic.opening_hours ?? null,
      ai_profile: {
        template_id: clinic.ai_template_id,
        overrides: clinic.ai_overrides ?? {},
      },
      whatsapp: {
        phone_number: row.phone_number,
        channel_id: row.id,
      },
    };

    return NextResponse.json(responseBody, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/clinics/by-number:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao buscar a clínica.",
      },
      { status: 500 },
    );
  }
}

