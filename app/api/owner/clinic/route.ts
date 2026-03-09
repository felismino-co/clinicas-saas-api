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

  if (!clinicId) {
    return badRequest("Parâmetro 'clinic_id' é obrigatório.");
  }

  const { data, error } = await supabase
    .from("clinics")
    .select("id, name, phone")
    .eq("id", clinicId)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Erro ao buscar clínica:", error);
    return NextResponse.json(
      { error: "database_error", message: "Falha ao buscar clínica." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "not_found", message: "Clínica não encontrada." },
      { status: 404 },
    );
  }

  const clinic = {
    id: data.id,
    name: data.name ?? "",
    phone: (data as { phone?: string | null }).phone ?? "",
    address: "",
  };

  return NextResponse.json({ clinic }, { status: 200 });
}

type PatchBody = {
  name?: string;
  phone?: string | null;
  address?: string | null;
};

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");

  if (!clinicId) {
    return badRequest("Parâmetro 'clinic_id' é obrigatório.");
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const updatePayload: Record<string, unknown> = {};
  if (body.name !== undefined) updatePayload.name = body.name;
  if (body.phone !== undefined) updatePayload.phone = body.phone ?? null;

  if (Object.keys(updatePayload).length === 0) {
    return badRequest("Nenhum campo para atualizar.");
  }

  const { data, error } = await supabase
    .from("clinics")
    .update(updatePayload)
    .eq("id", clinicId)
    .select("id, name, phone")
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Erro ao atualizar clínica:", error);
    return NextResponse.json(
      { error: "database_error", message: "Falha ao atualizar clínica." },
      { status: 500 },
    );
  }

  const clinic = {
    id: data.id,
    name: data.name ?? "",
    phone: (data as { phone?: string | null }).phone ?? "",
    address: "",
  };
  return NextResponse.json({ clinic }, { status: 200 });
}
