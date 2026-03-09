import { NextRequest, NextResponse } from "next/server";
import { createCookieStoreForRouteHandler, createSupabaseServerClient } from "../../../../lib/supabase-server";
import { supabase as supabaseAnon } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json(
      { message: "Payload inválido." },
      { status: 400 },
    );
  }

  const { email, password } = body;
  if (!email?.trim() || !password) {
    return NextResponse.json(
      { message: "Email e senha são obrigatórios." },
      { status: 400 },
    );
  }

  const cookieStore = createCookieStoreForRouteHandler(request);
  const supabase = createSupabaseServerClient(cookieStore);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return NextResponse.json(
      { message: "Credenciais inválidas." },
      { status: 401 },
    );
  }

  let role = "secretary";
  let clinic_id: string | null = null;

  const userId = data.user?.id;
  if (userId) {
    const { data: appUser } = await supabaseAnon
      .from("app_users")
      .select("role, clinic_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (appUser && (appUser as { role?: string }).role) {
      role = (appUser as { role: string }).role;
      clinic_id = (appUser as { clinic_id?: string }).clinic_id ?? null;
    } else {
      const { data: member } = await supabaseAnon
        .from("clinic_members")
        .select("role, clinic_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();

      if (member && (member as { role?: string }).role) {
        role = (member as { role: string }).role;
        clinic_id = (member as { clinic_id?: string }).clinic_id ?? null;
      }
    }
  }

  const normalizedRole =
    role === "admin_global" || role === "admin"
      ? "admin"
      : role === "clinic_owner" || role === "owner"
        ? "owner"
        : "secretary";

  const jsonResponse = NextResponse.json(
    { success: true, user: data.user, role: normalizedRole, clinic_id },
    { status: 200 },
  );
  cookieStore.appendCookiesToResponse(jsonResponse);
  return jsonResponse;
}
