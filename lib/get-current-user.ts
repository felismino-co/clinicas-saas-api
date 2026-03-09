import type { CookieStore } from "./supabase-server";
import { createSupabaseServerClient } from "./supabase-server";
import { supabase as supabaseAnon } from "./supabase";

export type CurrentUserInfo = {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  clinic_id: string | null;
};

/**
 * Obtém o usuário atual a partir do cookieStore (sessão).
 * Em route handlers use createCookieStoreForRouteHandler(request) e depois
 * chame store.appendCookiesToResponse(resposta) na NextResponse.json() retornada.
 */
export async function getCurrentUser(
  cookieStore: CookieStore,
): Promise<CurrentUserInfo | null> {
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: appUser } = await supabaseAnon
    .from("app_users")
    .select("clinic_id, full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const au = appUser as { clinic_id?: string; full_name?: string; email?: string } | null;
  return {
    user_id: user.id,
    user_name: au?.full_name ?? (user.user_metadata?.full_name as string) ?? null,
    user_email: user.email ?? au?.email ?? null,
    clinic_id: au?.clinic_id ?? null,
  };
}
