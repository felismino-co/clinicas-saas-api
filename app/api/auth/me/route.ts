import { NextRequest, NextResponse } from "next/server";
import { createCookieStoreForRouteHandler, createSupabaseServerClient } from "../../../../lib/supabase-server";
import { supabase as supabaseAnon } from "../../../../lib/supabase";

export async function GET(request: NextRequest) {
  const cookieStore = createCookieStoreForRouteHandler(request);
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json(
      { message: "Não autenticado." },
      { status: 401 },
    );
  }

  let role: string = "secretary";
  let clinic_id: string | null = null;

  const { data: appUser } = await supabaseAnon
    .from("app_users")
    .select("role, clinic_id, full_name, email")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (appUser && (appUser as { role?: string }).role) {
    role = (appUser as { role: string }).role;
    clinic_id = (appUser as { clinic_id?: string }).clinic_id ?? null;
  } else {
    const { data: member } = await supabaseAnon
      .from("clinic_members")
      .select("role, clinic_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (member && (member as { role?: string }).role) {
      role = (member as { role: string }).role;
      clinic_id = (member as { clinic_id?: string }).clinic_id ?? null;
    }
  }

  const full_name =
    (appUser as { full_name?: string } | undefined)?.full_name
    ?? (user.user_metadata?.full_name as string | undefined)
    ?? user.email
    ?? null;
  const email =
    (appUser as { email?: string } | undefined)?.email
    ?? user.email
    ?? null;

  const res = NextResponse.json({
    user_id: user.id,
    email,
    role,
    clinic_id,
    full_name,
  });
  cookieStore.appendCookiesToResponse(res);
  return res;
}
