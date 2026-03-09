import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

export async function GET() {
  try {
    const { data: plans, error } = await supabase
      .from("plans")
      .select("id, name, price_month, description, max_providers, is_active")
      .order("price_month", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      plans: (plans ?? []).map((p: Record<string, unknown>) => ({
        id: p.id,
        name: p.name,
        price_month: Number(p.price_month),
        description: (p.description as string) ?? "",
        max_providers: p.max_providers == null ? null : Number(p.max_providers),
        is_active: p.is_active !== false,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao listar planos." },
      { status: 500 },
    );
  }
}

type PatchBody = {
  name?: string;
  price_month?: number;
  description?: string;
  max_providers?: number;
};

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id?.trim()) {
    return NextResponse.json(
      { error: "bad_request", message: "Query 'id' é obrigatória." },
      { status: 400 },
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload JSON inválido." },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.price_month !== undefined) updates.price_month = body.price_month;
  if (body.description !== undefined) updates.description = body.description;
  if (body.max_providers !== undefined) updates.max_providers = body.max_providers;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "bad_request", message: "Nenhum campo para atualizar." },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await supabase
      .from("plans")
      .update(updates)
      .eq("id", id.trim())
      .select("id, name, price_month, description, max_providers")
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: error.message },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "not_found", message: "Plano não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      plan: {
        id: data.id,
        name: data.name,
        price_month: Number(data.price_month),
        description: (data.description as string) ?? "",
        max_providers: data.max_providers == null ? null : Number(data.max_providers),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao atualizar plano." },
      { status: 500 },
    );
  }
}
