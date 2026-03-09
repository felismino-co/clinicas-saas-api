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
    const { data: config } = await supabase
      .from("clinic_whatsapp_config")
      .select("zapi_instance_id, zapi_token")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .maybeSingle();

    if (!config?.zapi_instance_id || !config?.zapi_token) {
      return NextResponse.json(
        { connected: false, phone: null },
        { status: 200 },
      );
    }

    const instanceId = (config as { zapi_instance_id: string }).zapi_instance_id;
    const token = (config as { zapi_token: string }).zapi_token;

    const res = await fetch(
      `https://api.z-api.io/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(token)}/status`,
      { method: "GET" },
    );
    const data = (await res.json()) as { connected?: boolean; phone?: string };
    return NextResponse.json(
      {
        connected: Boolean(data?.connected),
        phone: data?.phone ?? null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { connected: false, phone: null },
      { status: 200 },
    );
  }
}
