import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

type PatchBody = {
  status?: string;
  needs_human?: boolean;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return badRequest("ID da conversa é obrigatório.");

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.status === "string" && body.status.trim()) {
    const s = body.status.trim().toLowerCase();
    if (["open", "waiting", "resolved"].includes(s)) {
      updates.status = s;
    }
  }
  if (typeof body.needs_human === "boolean") {
    updates.needs_human = body.needs_human;
  }

  if (Object.keys(updates).length === 0) {
    return badRequest("Envie status e/ou needs_human.");
  }

  try {
    const { data, error } = await supabase
      .from("conversations")
      .update(updates)
      .eq("id", id)
      .select("id, status, needs_human, last_message_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao atualizar conversa." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "not_found", message: "Conversa não encontrada." },
        { status: 404 },
      );
    }
    return NextResponse.json({ conversation: data }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao atualizar conversa." },
      { status: 500 },
    );
  }
}
