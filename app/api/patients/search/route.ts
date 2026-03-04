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
  const clinicId = url.searchParams.get("clinic_id");
  const phone = url.searchParams.get("phone");

  if (!clinicId || !phone) {
    return badRequest(
      "Parâmetros 'clinic_id' e 'phone' são obrigatórios na busca de pacientes.",
    );
  }

  try {
    const { data, error } = await supabase
      .from("patients")
      .select("id, clinic_id, full_name, phone, email, tags")
      .eq("clinic_id", clinicId)
      .eq("phone", phone);

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao buscar pacientes:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao buscar pacientes.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        patients: data ?? [],
      },
      { status: 200 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/patients/search:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao buscar pacientes.",
      },
      { status: 500 },
    );
  }
}

