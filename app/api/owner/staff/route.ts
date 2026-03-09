import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const STAFF_ROLES = ["receptionist"];

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const headerClinicId = request.headers.get("x-clinic-id");

  if (!clinicId && !headerClinicId) {
    return badRequest("clinic_id é obrigatório.");
  }
  const effectiveClinicId = clinicId ?? headerClinicId;
  if (headerClinicId && clinicId && headerClinicId !== clinicId) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado a esta clínica." }, { status: 403 });
  }

  const { data: staffRows, error } = await supabase
    .from("app_users")
    .select("id, user_id, clinic_id, role, full_name, email, active, created_at")
    .eq("clinic_id", effectiveClinicId)
    .in("role", STAFF_ROLES)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
  }

  const list = (staffRows ?? []) as Array<{
    id: string;
    user_id: string;
    role: string;
    full_name: string | null;
    email: string | null;
    active: boolean | null;
    created_at: string;
  }>;

  const { data: lastActivities } = await supabase
    .from("audit_log")
    .select("user_id, created_at")
    .eq("clinic_id", effectiveClinicId)
    .order("created_at", { ascending: false });

  const lastByUser: Record<string, string> = {};
  for (const row of lastActivities ?? []) {
    const uid = (row as { user_id?: string }).user_id;
    if (uid && !lastByUser[uid]) lastByUser[uid] = (row as { created_at: string }).created_at;
  }

  const staff = list.map((s) => ({
    id: s.id,
    user_id: s.user_id,
    full_name: s.full_name ?? "",
    email: s.email ?? "",
    role: s.role,
    active: s.active !== false,
    last_activity_at: lastByUser[s.user_id] ?? null,
    created_at: s.created_at,
  }));

  return NextResponse.json({ staff });
}

export async function POST(request: NextRequest) {
  const headerClinicId = request.headers.get("x-clinic-id");
  let body: { clinic_id: string; full_name: string; email: string; password: string; role: string };
  try {
    body = await request.json();
  } catch {
    return badRequest("Payload inválido.");
  }

  const { clinic_id, full_name, email, password, role } = body;
  const effectiveClinicId = clinic_id ?? headerClinicId;
  if (!effectiveClinicId) return badRequest("clinic_id é obrigatório.");
  if (headerClinicId && clinic_id && headerClinicId !== clinic_id) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado a esta clínica." }, { status: 403 });
  }
  if (!full_name?.trim() || !email?.trim() || !password?.trim()) {
    return badRequest("full_name, email e password são obrigatórios.");
  }
  const roleValue = "receptionist";

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "config_error", message: "Serviço de criação de usuários não configurado (SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password: password.trim(),
    email_confirm: true,
    user_metadata: { full_name: full_name.trim() },
  });

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: "auth_error", message: authError?.message ?? "Falha ao criar usuário." },
      { status: 400 },
    );
  }

  const { error: insertError } = await supabase.from("app_users").insert({
    id: crypto.randomUUID(),
    user_id: authData.user.id,
    clinic_id: effectiveClinicId,
    role: roleValue,
    full_name: full_name.trim(),
    email: email.trim(),
    active: true,
  } as Record<string, unknown>);

  if (insertError) {
    return NextResponse.json({ error: "database_error", message: insertError.message }, { status: 500 });
  }

  const { data: staffRows } = await supabase
    .from("app_users")
    .select("id, user_id, clinic_id, role, full_name, email, active, created_at")
    .eq("clinic_id", effectiveClinicId)
    .in("role", STAFF_ROLES)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    staff: (staffRows ?? []).map((s: Record<string, unknown>) => ({
      id: s.id,
      user_id: s.user_id,
      full_name: s.full_name ?? "",
      email: s.email ?? "",
      role: s.role,
      active: s.active !== false,
      last_activity_at: null,
      created_at: s.created_at,
    })),
  });
}
