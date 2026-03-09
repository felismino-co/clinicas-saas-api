import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

const ALLOWED_STATUSES = ["new", "contact", "proposal", "closed", "lost"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "bad_request", message: "ID é obrigatório." },
      { status: 400 },
    );
  }

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload JSON inválido." },
      { status: 400 },
    );
  }

  const { status } = body;
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "bad_request", message: "status deve ser: new, contact, proposal, closed ou lost." },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("marketing_leads")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "PGRST116") {
        return NextResponse.json(
          { error: "not_found", message: "Lead não encontrado." },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: "database_error", message: "Erro ao atualizar lead." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, lead: data }, { status: 200 });
  } catch (err) {
    console.error("marketing/leads PATCH error:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao atualizar lead." },
      { status: 500 },
    );
  }
}
