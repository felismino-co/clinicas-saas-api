import { NextRequest, NextResponse } from "next/server";
import { createCookieStoreForRouteHandler, createSupabaseServerClient } from "../../../../lib/supabase-server";

export async function POST(request: NextRequest) {
  const cookieStore = createCookieStoreForRouteHandler(request);
  const supabase = createSupabaseServerClient(cookieStore);

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload JSON inválido." },
      { status: 400 },
    );
  }

  const email = body.email?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "bad_request", message: "Campo 'email' é obrigatório." },
      { status: 400 },
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin}/login`,
  });

  if (error) {
    return NextResponse.json(
      { error: "auth_error", message: error.message },
      { status: 400 },
    );
  }

  const res = NextResponse.json({ success: true });
  cookieStore.appendCookiesToResponse(res);
  return res;
}
