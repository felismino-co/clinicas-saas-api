import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  try {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, clinic_id, name, segment, message_template, status, scheduled_at, sent_at, total_sent, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao listar campanhas." },
        { status: 500 },
      );
    }
    return NextResponse.json({ campaigns: data ?? [] }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao listar campanhas." },
      { status: 500 },
    );
  }
}

type PostBody = {
  clinic_id: string;
  name: string;
  segment: string;
  message_template: string;
  scheduled_at?: string | null;
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic_id, name, segment, message_template, scheduled_at } = body;
  if (!clinic_id?.trim() || !name?.trim() || !segment?.trim() || !message_template?.trim()) {
    return badRequest("clinic_id, name, segment e message_template são obrigatórios.");
  }

  const validSegments = ["todos", "inativos", "vip", "novos"];
  if (!validSegments.includes(segment.toLowerCase())) {
    return badRequest("segment deve ser: todos, inativos, vip ou novos.");
  }

  try {
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        clinic_id: clinic_id.trim(),
        name: name.trim(),
        segment: segment.toLowerCase(),
        message_template: message_template.trim(),
        status: scheduled_at ? "scheduled" : "draft",
        scheduled_at: scheduled_at?.trim() || null,
      } as Record<string, unknown>)
      .select("id, name, segment, status, scheduled_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao criar campanha." },
        { status: 500 },
      );
    }
    return NextResponse.json({ campaign: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao criar campanha." },
      { status: 500 },
    );
  }
}
