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
  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  try {
    const { data, error } = await supabase
      .from("clinic_ai_profiles")
      .select("id, clinic_id, assistant_name, tone, context, is_active, automations")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao buscar perfil." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { profile: null },
        { status: 200 },
      );
    }

    const row = data as Record<string, unknown>;
    const automations = (row.automations as Record<string, boolean>) ?? {};
    const profile = {
      id: row.id,
      clinic_id: row.clinic_id,
      assistant_name: row.assistant_name ?? "Ana",
      tone: row.tone ?? "humanizado",
      context: row.context ?? "",
      is_active: row.is_active !== false,
      automations: {
        reminder_48h: automations.reminder_48h !== false,
        reminder_24h: automations.reminder_24h !== false,
        post_2h: automations.post_2h !== false,
        post_7d: automations.post_7d !== false,
        reactivation_90: automations.reactivation_90 !== false,
      },
    };
    return NextResponse.json({ profile }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar perfil." },
      { status: 500 },
    );
  }
}

type ProfileBody = {
  assistant_name?: string;
  tone?: string;
  context?: string;
  automations?: {
    reminder_48h?: boolean;
    reminder_24h?: boolean;
    post_2h?: boolean;
    post_7d?: boolean;
    reactivation_90?: boolean;
  };
};

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  let body: ProfileBody;
  try {
    body = (await request.json()) as ProfileBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const updates: Record<string, unknown> = {};
  if (body.assistant_name !== undefined) updates.assistant_name = body.assistant_name.trim();
  if (body.tone !== undefined) updates.tone = body.tone;
  if (body.context !== undefined) updates.context = body.context;
  if (body.automations !== undefined) updates.automations = body.automations;

  if (Object.keys(updates).length === 0) {
    return badRequest("Nenhum campo para atualizar.");
  }

  try {
    const { data: existing } = await supabase
      .from("clinic_ai_profiles")
      .select("id")
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from("clinic_ai_profiles")
        .update(updates)
        .eq("clinic_id", clinicId)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "database_error", message: "Falha ao atualizar perfil." },
          { status: 500 },
        );
      }
      return NextResponse.json({ profile: data }, { status: 200 });
    }

    const { data: inserted, error } = await supabase
      .from("clinic_ai_profiles")
      .insert({
        clinic_id: clinicId,
        assistant_name: updates.assistant_name ?? "Ana",
        tone: updates.tone ?? "humanizado",
        context: updates.context ?? "",
        automations: updates.automations ?? {},
      } as Record<string, unknown>)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao criar perfil." },
        { status: 500 },
      );
    }
    return NextResponse.json({ profile: inserted }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao salvar perfil." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
