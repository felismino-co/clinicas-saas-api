import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const COOKIE_NAME = "sb-auth-token";

export async function POST() {
  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set(COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 0,
  });
  return response;
}
