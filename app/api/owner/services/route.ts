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
    .from("services")
    .select("id, clinic_id, name")
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true });

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Erro ao listar serviços:", error);
    return NextResponse.json(
      { error: "database_error", message: "Falha ao listar serviços." },
      { status: 500 },
    );
  }

  return NextResponse.json({ services: data ?? [] }, { status: 200 });
}

type PostBody = {
  clinic_id: string;
  name: string;
  duration_minutes?: number | null;
  price?: number | string | null;
  description?: string | null;
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic_id, name, duration_minutes, price, description } = body;
  if (!clinic_id || !name?.trim()) {
    return badRequest("Campos obrigatórios: 'clinic_id', 'name'.");
  }

  const priceNum =
    typeof price === "number" ? price : typeof price === "string" ? parseFloat(String(price).replace(",", ".")) : null;

  // Usar apenas colunas que existem na tabela services (id, clinic_id, name; opcionais: duration_minutes, price, description)
  const insertPayload: Record<string, unknown> = {
    clinic_id,
    name: name.trim(),
  };
  if (duration_minutes != null && !Number.isNaN(Number(duration_minutes))) {
    insertPayload.duration_minutes = Number(duration_minutes);
  }
  if (priceNum != null && !Number.isNaN(priceNum)) {
    insertPayload.price = priceNum;
  }
  if (description !== undefined && description !== null && String(description).trim()) {
    insertPayload.description = String(description).trim();
  }

  // eslint-disable-next-line no-console
  console.log("[services POST] insertPayload:", JSON.stringify(insertPayload));

  const { data, error } = await supabase
    .from("services")
    .insert(insertPayload)
    .select("id, clinic_id, name")
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Erro ao criar serviço:", error.message, error.details, error.hint);
    return NextResponse.json(
      { error: "database_error", message: error.message ?? "Falha ao criar serviço." },
      { status: 500 },
    );
  }

  return NextResponse.json({ service: data }, { status: 201 });
}
