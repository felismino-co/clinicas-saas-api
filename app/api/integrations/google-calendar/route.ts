import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const providerId = url.searchParams.get("provider_id");
  if (!providerId) return badRequest("provider_id é obrigatório.");

  try {
    const { data, error } = await supabase
      .from("calendar_integrations")
      .select("id, google_calendar_id, is_active, created_at")
      .eq("provider_id", providerId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
    }

    if (!data || !(data as { id?: string }).id) {
      return NextResponse.json({ connected: false, email: null });
    }

    const row = data as { google_calendar_id?: string };
    return NextResponse.json({
      connected: true,
      email: row.google_calendar_id ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao verificar integração." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  // OAuth flow placeholder — em breve
  return NextResponse.json({ coming_soon: true, message: "Disponível na próxima versão." }, { status: 200 });
}

export async function DELETE(request: NextRequest) {
  const url = new URL(request.url);
  const providerId = url.searchParams.get("provider_id");
  if (!providerId) return badRequest("provider_id é obrigatório.");

  try {
    const { error } = await supabase
      .from("calendar_integrations")
      .update({ is_active: false } as Record<string, unknown>)
      .eq("provider_id", providerId);

    if (error) {
      return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao desconectar." },
      { status: 500 },
    );
  }
}
