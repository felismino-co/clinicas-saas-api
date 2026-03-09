import { NextRequest, NextResponse } from "next/server";
import { createCookieStoreForRouteHandler, createSupabaseServerClient } from "../../../../lib/supabase-server";
import { supabase as supabaseAnon } from "../../../../lib/supabase";

/**
 * Diagnóstico temporário: retorna usuário logado, app_users e clinic_id.
 * GET /api/debug/user-clinic
 */
export async function GET(request: NextRequest) {
  const cookieStore = createCookieStoreForRouteHandler(request);
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "not_authenticated", message: "Não autenticado." },
      { status: 401 },
    );
  }

  const appUserFromAppUsers = await supabaseAnon
    .from("app_users")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const appUserFromMembers = await supabaseAnon
    .from("clinic_members")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email ?? null,
      user_metadata: user.user_metadata,
    },
    app_users_row: appUserFromAppUsers.data ?? null,
    app_users_error: appUserFromAppUsers.error?.message ?? null,
    clinic_members_row: appUserFromMembers.data ?? null,
    clinic_members_error: appUserFromMembers.error?.message ?? null,
    inferred_clinic_id: (appUserFromAppUsers.data as { clinic_id?: string } | null)?.clinic_id
      ?? (appUserFromMembers.data as { clinic_id?: string } | null)?.clinic_id
      ?? null,
  });
  cookieStore.appendCookiesToResponse(res);
  return res;
}
