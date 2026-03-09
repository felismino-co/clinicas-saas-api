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
  const q = url.searchParams.get("q")?.trim() || "";
  const phone = url.searchParams.get("phone")?.trim();

  if (!clinicId) {
    return badRequest("Parâmetro 'clinic_id' é obrigatório.");
  }

  try {
    let query = supabase
      .from("patients")
      .select("id, clinic_id, full_name, phone, email, tags")
      .eq("clinic_id", clinicId);

    if (phone) {
      query = query.eq("phone", phone);
    } else if (q) {
      query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
    } else {
      return NextResponse.json({ patients: [] }, { status: 200 });
    }

    const { data, error } = await query;

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

