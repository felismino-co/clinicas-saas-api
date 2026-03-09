import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "./lib/supabase-server";
import { supabase as supabaseAnon } from "./lib/supabase";

const PROTECTED_PREFIXES = ["/secretary", "/owner", "/admin", "/profile"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function isPublic(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/landing" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/booking/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/onboarding") ||
    pathname.startsWith("/api/booking") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}

type Role = "admin" | "owner" | "secretary";

function normalizeRole(dbRole: string | null): Role {
  if (dbRole === "admin_global" || dbRole === "admin") return "admin";
  if (dbRole === "clinic_owner" || dbRole === "owner") return "owner";
  return "secretary";
}

function canAccess(pathname: string, role: Role): boolean {
  const isAdmin = role === "admin";
  if (pathname.startsWith("/admin")) return isAdmin;
  if (pathname.startsWith("/owner")) return isAdmin || role === "owner";
  if (pathname.startsWith("/secretary")) return isAdmin || role === "owner" || role === "secretary";
  if (pathname.startsWith("/profile")) return true;
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });
  const supabase = createServerClient(request, response);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  let role: Role | null = null;
  let clinicId: string | null = null;

  const { data: appUser } = await supabaseAnon
    .from("app_users")
    .select("role, clinic_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (appUser && (appUser as { role?: string }).role) {
    role = normalizeRole((appUser as { role: string }).role);
    clinicId = (appUser as { clinic_id?: string }).clinic_id ?? null;
  } else {
    const { data: member } = await supabaseAnon
      .from("clinic_members")
      .select("role, clinic_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (member && (member as { role?: string }).role) {
      role = normalizeRole((member as { role: string }).role);
      clinicId = (member as { clinic_id?: string }).clinic_id ?? null;
    }
  }

  // Só bloquear se não tiver nenhuma role (admin/admin_global com clinic_id null: permitir)
  if (!role) {
    const unauthorizedUrl = new URL("/unauthorized", request.url);
    return NextResponse.redirect(unauthorizedUrl);
  }

  if (!canAccess(pathname, role)) {
    const unauthorizedUrl = new URL("/unauthorized", request.url);
    return NextResponse.redirect(unauthorizedUrl);
  }

  // Se tem role, permitir acesso mesmo com clinic_id null; a página trata.
  const requestHeaders = new Headers(request.headers);
  if (clinicId) {
    requestHeaders.set("x-clinic-id", clinicId);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/",
    "/landing",
    "/secretary",
    "/secretary/:path*",
    "/owner",
    "/owner/:path*",
    "/admin",
    "/admin/:path*",
    "/login",
    "/unauthorized",
    "/profile",
    "/profile/:path*",
  ],
};
