import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

type PatchBody = {
  full_name?: string;
  specialty?: string | null;
  phone?: string | null;
  email?: string | null;
  crm?: string | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return badRequest("ID do profissional é obrigatório.");

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const updates: Record<string, unknown> = {};
  if (body.full_name !== undefined) updates.full_name = body.full_name?.trim() || null;
  if (body.specialty !== undefined) updates.specialty = body.specialty?.trim() || null;
  if (body.phone !== undefined) updates.phone = body.phone?.trim() || null;
  if (body.email !== undefined) updates.email = body.email?.trim() || null;
  if (body.crm !== undefined) updates.crm = body.crm?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return badRequest("Nenhum campo para atualizar.");
  }

  const { data, error } = await supabase
    .from("providers")
    .update(updates)
    .eq("id", id)
    .select("id, clinic_id, full_name, specialty, phone, email, crm")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "database_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ provider: data }, { status: 200 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "bad_request", message: "ID do profissional é obrigatório." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("providers").delete().eq("id", id);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Erro ao remover profissional:", error);
    return NextResponse.json(
      { error: "database_error", message: "Falha ao remover profissional." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
