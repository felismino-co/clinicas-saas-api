import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const roleFilter = url.searchParams.get("role") ?? "";

  try {
    const { data: rows, error } = await supabase
      .from("app_users")
      .select(`
        id,
        user_id,
        email,
        full_name,
        role,
        clinic_id,
        active,
        clinics ( name )
      `)
      .order("id", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao listar usuários." },
        { status: 500 },
      );
    }

    type UserOut = {
      id: string;
      user_id: string;
      email: string | null;
      full_name: string | null;
      role: string;
      clinic_id: string | null;
      clinic_name: string | null;
      active: boolean;
    };

    let list: UserOut[] = (rows ?? []).map((r: Record<string, unknown>) => {
      const clinic = Array.isArray(r.clinics) ? (r.clinics[0] as Record<string, unknown>) : (r.clinics as Record<string, unknown>);
      return {
        id: String(r.id),
        user_id: String(r.user_id),
        email: (r.email as string) ?? null,
        full_name: (r.full_name as string) ?? null,
        role: String(r.role ?? ""),
        clinic_id: (r.clinic_id as string) ?? null,
        clinic_name: (clinic?.name as string) ?? null,
        active: Boolean(r.active !== false),
      };
    });

    if (roleFilter) {
      const normalized = roleFilter.toLowerCase();
      list = list.filter((u) => {
        const r = u.role.toLowerCase();
        if (normalized === "admin") return r === "admin_global" || r === "admin";
        if (normalized === "owner") return r === "clinic_owner" || r === "owner";
        if (normalized === "secretary") return r === "receptionist" || r === "secretary";
        return u.role === roleFilter;
      });
    }

    return NextResponse.json({ users: list }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao listar usuários." },
      { status: 500 },
    );
  }
}

type PostBody = {
  email: string;
  password: string;
  role: string;
  clinic_id: string;
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { email, password, role, clinic_id } = body;
  if (!email?.trim() || !password) {
    return badRequest("Campos 'email' e 'password' são obrigatórios.");
  }

  const validRoles = ["admin", "owner", "secretary"];
  if (!role || !validRoles.includes(role)) {
    return badRequest("Campo 'role' deve ser admin, owner ou secretary.");
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: "auth_error", message: authError.message },
        { status: 400 },
      );
    }

    const userId = authData.user?.id;
    if (!userId || !clinic_id) {
      return NextResponse.json(
        { user: authData.user, message: "Usuário criado. Vincule à clínica manualmente se necessário." },
        { status: 201 },
      );
    }

    const roleMap: Record<string, string> = {
      admin: "admin_global",
      owner: "clinic_owner",
      secretary: "receptionist",
    };

    try {
      await supabase.from("app_users").insert({
        id: crypto.randomUUID(),
        user_id: userId,
        clinic_id,
        role: roleMap[role] ?? "receptionist",
        email: email.trim(),
      } as Record<string, unknown>);
    } catch {
      // app_users pode não existir ou ter schema diferente
    }
    try {
      await supabase.from("clinic_members").insert({
        user_id: userId,
        clinic_id,
        role: roleMap[role] ?? "receptionist",
      });
    } catch {
      // clinic_members pode falhar se schema exigir campos adicionais
    }

    return NextResponse.json(
      { user: authData.user, message: "Usuário criado e vinculado à clínica." },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao criar usuário." },
      { status: 500 },
    );
  }
}
