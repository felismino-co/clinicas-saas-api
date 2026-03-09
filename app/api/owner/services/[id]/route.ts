import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: "bad_request", message: "ID do serviço é obrigatório." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) {
    // eslint-disable-next-line no-console
    console.error("Erro ao remover serviço:", error);
    return NextResponse.json(
      { error: "database_error", message: "Falha ao remover serviço." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
