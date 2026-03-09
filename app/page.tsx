import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../lib/supabase-server";
import { supabase as supabaseAnon } from "../lib/supabase";

export default async function HomePage() {
  const cookieList = await cookies();
  const cookieStore = {
    getAll() {
      return cookieList.getAll().map((c) => ({ name: c.name, value: c.value }));
    },
    setAll() {
      // No-op; session refresh handled in middleware/route handlers
    },
  };
  const supabase = createSupabaseServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let role: string | null = null;
  const { data: appUser } = await supabaseAnon
    .from("app_users")
    .select("role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (appUser && (appUser as { role?: string }).role) {
    role = (appUser as { role: string }).role;
  } else {
    const { data: member } = await supabaseAnon
      .from("clinic_members")
      .select("role")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (member && (member as { role?: string }).role) {
      role = (member as { role: string }).role;
    }
  }

  const r = (role ?? "").toLowerCase();
  if (r === "admin_global" || r === "admin") {
    redirect("/admin");
  }
  if (r === "clinic_owner" || r === "owner") {
    redirect("/owner");
  }
  redirect("/secretary");
}
