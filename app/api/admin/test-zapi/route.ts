import { NextRequest, NextResponse } from "next/server";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const instanceId = url.searchParams.get("instance_id");
  const token = url.searchParams.get("token");

  if (!instanceId?.trim() || !token?.trim()) {
    return badRequest("instance_id e token são obrigatórios.");
  }

  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${encodeURIComponent(instanceId.trim())}/token/${encodeURIComponent(token.trim())}/status`,
      { method: "GET" },
    );
    const data = (await res.json()) as { connected?: boolean; phone?: string; error?: string };
    if (!res.ok) {
      return NextResponse.json(
        { connected: false, phone: null, error: data?.error ?? "Falha ao verificar Z-API." },
        { status: 200 },
      );
    }
    return NextResponse.json(
      { connected: Boolean(data?.connected), phone: data?.phone ?? null },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { connected: false, phone: null, error: "Erro ao conectar na Z-API." },
      { status: 200 },
    );
  }
}
