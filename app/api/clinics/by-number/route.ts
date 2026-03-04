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

    const row = data as WhatsappChannelWithClinic | null;

    if (!row || !row.clinic) {
      return NextResponse.json(
        {
          error: "clinic_not_found",
          message: "Nenhuma clínica configurada para este número.",
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

