import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

function mapClinicToItem(c: Record<string, unknown>, minimal = false) {
  const score = minimal ? 20 : (typeof c.completion_score === "number" ? c.completion_score : 20);
  return {
    id: c.id,
    name: c.name,
    phone: c.phone ?? null,
    status: minimal ? "active" : (c.active === false ? "inactive" : "active"),
    plan: c.plan ?? "trial",
    plan_expires_at: minimal ? null : (c.plan_expires_at ?? null),
    created_at: c.created_at,
    completion_score: score,
  };
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("clinics")
      .select("id, name, phone, created_at, completion_score, active, plan, plan_expires_at")
      .order("name", { ascending: true });

    if (!error && data) {
      const list = data.map((c: Record<string, unknown>) => mapClinicToItem(c));
      return NextResponse.json({ clinics: list }, { status: 200 });
    }
  } catch {
    // fallback para select mínimo
  }

  try {
    const { data: dataMin, error: errMin } = await supabase
      .from("clinics")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (errMin) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao listar clínicas." },
        { status: 500 },
      );
    }
    const list = (dataMin ?? []).map((c: Record<string, unknown>) => mapClinicToItem(c, true));
    return NextResponse.json({ clinics: list }, { status: 200 });
  } catch (err) {
    console.error("Erro clinics GET:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao listar clínicas." },
      { status: 500 },
    );
  }
}

type PostBody = {
  name: string;
  phone?: string;
  email?: string;
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { name } = body;
  if (!name?.trim()) {
    return badRequest("Campo 'name' é obrigatório.");
  }

  try {
    const { data, error } = await supabase
      .from("clinics")
      .insert({
        name: name.trim(),
        phone: body.phone?.trim() ?? null,
      })
      .select("id, name, phone, created_at")
      .single();

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao criar clínica." },
        { status: 500 },
      );
    }

    return NextResponse.json({ clinic: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao criar clínica." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("Parâmetro 'id' é obrigatório.");

  let body: { status?: string };
  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const status = body.status;
  if (!status || !["active", "inactive"].includes(status)) {
    return badRequest("Campo 'status' deve ser 'active' ou 'inactive'.");
  }

  try {
    const updatePayload: Record<string, unknown> = {};
    const { data: clinic, error: selectError } = await supabase
      .from("clinics")
      .select("id")
      .eq("id", id)
      .single();

    if (selectError) {
      console.error("Erro clinics PATCH (select):", selectError);
    }

    if (!clinic) {
      return NextResponse.json(
        { error: "not_found", message: "Clínica não encontrada." },
        { status: 404 },
      );
    }

    if ("active" in (clinic as Record<string, unknown>)) {
      updatePayload.active = status === "active";
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from("clinics")
        .update(updatePayload)
        .eq("id", id);
      if (error) {
        return NextResponse.json(
          { error: "database_error", message: "Falha ao atualizar status." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao atualizar clínica." },
      { status: 500 },
    );
  }
}
