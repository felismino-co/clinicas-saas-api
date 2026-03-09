import { NextRequest, NextResponse } from "next/server";
import { createCookieStoreForRouteHandler, createSupabaseServerClient } from "../../../lib/supabase-server";
import { supabase as supabaseAnon } from "../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

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

  let role = "secretary";
  const { data: appUser } = await supabaseAnon
    .from("app_users")
    .select("role, full_name, email")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (appUser && (appUser as { role?: string }).role) {
    role = (appUser as { role: string }).role;
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const full_name =
    (metadata.full_name as string) ??
    (appUser as { full_name?: string } | undefined)?.full_name ??
    "";
  const phone = (metadata.phone as string) ?? "";
  const preferences = (metadata.preferences as Record<string, unknown>) ?? {};

  const res = NextResponse.json({
    user: {
      email: user.email ?? "",
      full_name,
      phone,
      role,
      created_at: user.created_at ?? null,
      preferences: {
        email_notifications: preferences.email_notifications !== false,
        daily_summary: preferences.daily_summary === true,
        timezone: (preferences.timezone as string) ?? "America/Sao_Paulo",
      },
    },
  });
  cookieStore.appendCookiesToResponse(res);
  return res;
}

type PatchBody = {
  full_name?: string;
  phone?: string;
  current_password?: string;
  new_password?: string;
  preferences?: {
    email_notifications?: boolean;
    daily_summary?: boolean;
    timezone?: string;
  };
};

export async function PATCH(request: NextRequest) {
  const cookieStore = createCookieStoreForRouteHandler(request);
  const supabase = createSupabaseServerClient(cookieStore);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { message: "Não autenticado." },
      { status: 401 },
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  let dataUpdate: Record<string, unknown> | undefined;

  if (body.full_name !== undefined || body.phone !== undefined) {
    dataUpdate = {
      ...metadata,
      full_name: body.full_name !== undefined ? body.full_name : (metadata.full_name as string),
      phone: body.phone !== undefined ? body.phone : (metadata.phone as string),
    };
  }

  if (body.preferences !== undefined) {
    const currentPrefs = (metadata.preferences as Record<string, unknown>) ?? {};
    dataUpdate = {
      ...(dataUpdate ?? metadata),
      preferences: {
        ...currentPrefs,
        ...body.preferences,
      },
    };
  }

  const updates: { data?: Record<string, unknown>; password?: string } = {};
  if (dataUpdate) updates.data = dataUpdate;

  if (body.new_password !== undefined && body.new_password.trim()) {
    if (!body.current_password?.trim()) {
      return badRequest("Senha atual é obrigatória para alterar a senha.");
    }
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: user.email ?? "",
      password: body.current_password,
    });
    if (signError) {
      return NextResponse.json(
        { message: "Senha atual incorreta." },
        { status: 400 },
      );
    }
    updates.password = body.new_password;
  }

  if (!updates.data && !updates.password) {
    return badRequest("Nenhum campo para atualizar.");
  }

  const { error: updateError } = await supabase.auth.updateUser(updates);

  if (updateError) {
    return NextResponse.json(
      { message: updateError.message ?? "Falha ao atualizar perfil." },
      { status: 500 },
    );
  }

  const res = NextResponse.json({ success: true });
  cookieStore.appendCookiesToResponse(res);
  return res;
}