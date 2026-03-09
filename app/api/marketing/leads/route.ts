import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("marketing_leads")
      .select("id, clinic_id, clinic_name, contact_name, whatsapp, service, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("marketing/leads GET error:", error);
      return NextResponse.json(
        { error: "database_error", message: "Erro ao listar leads." },
        { status: 500 },
      );
    }

    const list = data ?? [];
    const new_count = list.filter((r: { status?: string }) => r.status === "new").length;
    return NextResponse.json({ leads: list, new_count }, { status: 200 });
  } catch (err) {
    console.error("marketing/leads GET error:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao listar leads." },
      { status: 500 },
    );
  }
}
