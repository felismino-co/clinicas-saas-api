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
    .from("providers")
    .select("id, clinic_id, full_name, specialty, phone, email, crm")
    .eq("clinic_id", clinicId)
    .order("full_name", { ascending: true });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Erro ao listar profissionais:", error);
    return NextResponse.json(
      { error: "database_error", message: "Falha ao listar profissionais." },
      { status: 500 },
    );
  }

  return NextResponse.json({ providers: data ?? [] }, { status: 200 });
}

type PostBody = {
  clinic_id: string;
  full_name: string;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  crm?: string | null;
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic_id, full_name, specialty, phone, email, crm } = body;
  if (!clinic_id || !full_name?.trim()) {
    return badRequest("Campos obrigatórios: 'clinic_id', 'full_name'.");
  }

  const insertPayload: Record<string, unknown> = {
    clinic_id,
    full_name: full_name.trim(),
  };
  if (specialty !== undefined) insertPayload.specialty = specialty?.trim() || null;
  if (phone !== undefined) insertPayload.phone = phone?.trim() || null;
  if (email !== undefined) insertPayload.email = email?.trim() || null;
  if (crm !== undefined) insertPayload.crm = crm?.trim() || null;

  const { data, error } = await supabase
    .from("providers")
    .insert(insertPayload)
    .select("id, clinic_id, full_name, specialty, phone, email, crm")
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Erro ao criar profissional:", error);
    return NextResponse.json(
      { error: "database_error", message: "Falha ao criar profissional." },
      { status: 500 },
    );
  }

  return NextResponse.json({ provider: data }, { status: 201 });
}
