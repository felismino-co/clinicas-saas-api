import { NextRequest, NextResponse } from "next/server";
import { createCookieStoreForRouteHandler } from "../../../../lib/supabase-server";
import { getCurrentUser } from "../../../../lib/get-current-user";
import { logAction } from "../../../../lib/audit";

export async function POST(request: NextRequest) {
  const cookieStore = createCookieStoreForRouteHandler(request);
  const currentUser = await getCurrentUser(cookieStore);

  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: { action: string; entity_type?: string; entity_id?: string; details?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const { action, entity_type, entity_id, details } = body;
  if (!action || typeof action !== "string") {
    return NextResponse.json({ error: "action é obrigatório." }, { status: 400 });
  }

  await logAction({
    clinic_id: currentUser.clinic_id,
    user_id: currentUser.user_id,
    user_name: currentUser.user_name,
    user_email: currentUser.user_email,
    action,
    entity_type: entity_type ?? null,
    entity_id: entity_id ?? null,
    details: details ?? null,
  });

  const res = NextResponse.json({ ok: true });
  cookieStore.appendCookiesToResponse(res);
  return res;
}
