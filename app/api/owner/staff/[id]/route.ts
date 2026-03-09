import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headerClinicId = request.headers.get("x-clinic-id");

  let body: { full_name?: string; email?: string; password?: string; active?: boolean };
  try {
    body = await request.json();
  } catch {
    return badRequest("Payload inválido.");
  }

  const { data: appUser, error: fetchError } = await supabase
    .from("app_users")
    .select("id, user_id, clinic_id")
    .eq("id", id)
    .single();

  if (fetchError || !appUser) {
    return NextResponse.json({ error: "not_found", message: "Funcionário não encontrado." }, { status: 404 });
  }

  const clinicId = (appUser as { clinic_id?: string }).clinic_id;
  if (headerClinicId && clinicId !== headerClinicId) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado." }, { status: 403 });
  }

  const userId = (appUser as { user_id: string }).user_id;
  const updates: Record<string, unknown> = {};

  if (body.full_name !== undefined) updates.full_name = body.full_name;
  if (body.email !== undefined) updates.email = body.email;
  if (body.active !== undefined) updates.active = body.active;

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabase
      .from("app_users")
      .update(updates)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "database_error", message: updateError.message }, { status: 500 });
    }
  }

  if (body.password?.trim() && supabaseAdmin) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: body.password.trim(),
      user_metadata: body.full_name !== undefined ? { full_name: body.full_name } : undefined,
    });
    if (authError) {
      return NextResponse.json({ error: "auth_error", message: authError.message }, { status: 400 });
    }
  } else if (body.full_name !== undefined && supabaseAdmin) {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: body.full_name },
    });
  }

  const { data: updated } = await supabase
    .from("app_users")
    .select("id, user_id, clinic_id, role, full_name, email, active, created_at")
    .eq("id", id)
    .single();

  return NextResponse.json({
    staff: updated
      ? {
          id: updated.id,
          user_id: (updated as { user_id: string }).user_id,
          full_name: (updated as { full_name?: string }).full_name ?? "",
          email: (updated as { email?: string }).email ?? "",
          role: (updated as { role: string }).role,
          active: (updated as { active?: boolean }).active !== false,
          created_at: (updated as { created_at: string }).created_at,
        }
      : null,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headerClinicId = request.headers.get("x-clinic-id");

  const { data: appUser, error: fetchError } = await supabase
    .from("app_users")
    .select("id, clinic_id")
    .eq("id", id)
    .single();

  if (fetchError || !appUser) {
    return NextResponse.json({ error: "not_found", message: "Funcionário não encontrado." }, { status: 404 });
  }

  const clinicId = (appUser as { clinic_id?: string }).clinic_id;
  if (headerClinicId && clinicId !== headerClinicId) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado." }, { status: 403 });
  }

  const { error: deleteError } = await supabase.from("app_users").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "database_error", message: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
