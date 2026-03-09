import { NextRequest, NextResponse } from "next/server";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

const TYPES = ["reminders", "post_consultation", "reactivation"] as const;

export async function POST(request: NextRequest) {
  let body: { clinic_id?: string; type?: string };
  try {
    body = (await request.json()) as { clinic_id?: string; type?: string };
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic_id, type } = body;
  if (!clinic_id?.trim()) return badRequest("clinic_id é obrigatório.");
  if (!type || !TYPES.includes(type as (typeof TYPES)[number])) {
    return badRequest("type deve ser: reminders, post_consultation ou reactivation.");
  }

  const origin = request.nextUrl.origin;
  const url =
    type === "reminders"
      ? `${origin}/api/automations/reminders`
      : type === "post_consultation"
        ? `${origin}/api/automations/post-consultation`
        : `${origin}/api/automations/reactivation`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clinic_id: clinic_id.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao executar automação." },
      { status: 500 },
    );
  }
}
