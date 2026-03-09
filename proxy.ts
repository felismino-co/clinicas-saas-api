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
    pathname === "/subscription-blocked" ||
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

  // Admin nunca bloqueia por assinatura
  const isAdminRole = role === "admin";
  if (isAdminRole) {
    const requestHeaders = new Headers(request.headers);
    if (clinicId) requestHeaders.set("x-clinic-id", clinicId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Verificação de assinatura para /owner e /secretary
  if ((pathname.startsWith("/owner") || pathname.startsWith("/secretary")) && clinicId) {
    const { data: clinic } = await supabaseAnon
      .from("clinics")
      .select("active, subscription_status, plan_expires_at")
      .eq("id", clinicId)
      .maybeSingle();

    if (clinic) {
      const row = clinic as { active?: boolean; subscription_status?: string; plan_expires_at?: string | null };
      const active = row.active !== false;
      const status = row.subscription_status ?? "trial";
      const expiresAt = row.plan_expires_at ? new Date(row.plan_expires_at) : null;
      const now = new Date();

      if (!active) {
        const reason = status === "blocked" ? "blocked" : status === "canceled" ? "canceled" : "trial_expired";
        const blockedUrl = new URL("/subscription-blocked", request.url);
        blockedUrl.searchParams.set("reason", reason);
        return NextResponse.redirect(blockedUrl);
      }
      if (status === "trial" && expiresAt && expiresAt.getTime() < now.getTime()) {
        const blockedUrl = new URL("/subscription-blocked", request.url);
        blockedUrl.searchParams.set("reason", "trial_expired");
        return NextResponse.redirect(blockedUrl);
      }

      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-clinic-id", clinicId);
      if (status === "overdue") {
        const res = NextResponse.next({ request: { headers: requestHeaders } });
        res.headers.set("x-subscription-overdue", "true");
        return res;
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
  }

  const requestHeaders = new Headers(request.headers);
  if (clinicId) requestHeaders.set("x-clinic-id", clinicId);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/",
    "/landing",
    "/subscription-blocked",
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
