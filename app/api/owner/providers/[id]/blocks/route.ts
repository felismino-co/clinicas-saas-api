import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: providerId } = await params;

  if (!providerId) {
    return badRequest("provider_id é obrigatório.");
  }

  const { data, error } = await supabase
    .from("provider_blocks")
    .select("id, provider_id, clinic_id, blocked_date, reason, created_at")
    .eq("provider_id", providerId)
    .order("blocked_date", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "database_error", message: error.message },
      { status: 500 },
    );
  }

  const blocks = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    provider_id: row.provider_id,
    clinic_id: row.clinic_id,
    blocked_date: row.blocked_date,
    reason: row.reason ?? null,
    created_at: row.created_at,
  }));

  return NextResponse.json({ blocks });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: providerId } = await params;
  let body: { clinic_id: string; blocked_date: string; reason?: string };

  try {
    body = await request.json();
  } catch {
    return badRequest("Payload inválido.");
  }

  const { clinic_id, blocked_date, reason } = body;
  if (!providerId || !clinic_id || !blocked_date) {
    return badRequest("provider_id, clinic_id e blocked_date são obrigatórios.");
  }

  const dateStr = String(blocked_date).slice(0, 10);
  const { data, error } = await supabase
    .from("provider_blocks")
    .insert({
      provider_id: providerId,
      clinic_id,
      blocked_date: dateStr,
      reason: reason?.trim() || null,
    } as Record<string, unknown>)
    .select("id, provider_id, clinic_id, blocked_date, reason, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "database_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ block: data }, { status: 201 });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: providerId } = await params;
  const url = new URL(request.url);
  const blockId = url.searchParams.get("block_id");

  if (!blockId) {
    return badRequest("block_id é obrigatório.");
  }

  let query = supabase.from("provider_blocks").delete().eq("id", blockId);
  if (providerId) {
    query = query.eq("provider_id", providerId);
  }

  const { error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "database_error", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
