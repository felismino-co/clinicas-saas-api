import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { createCookieStoreForRouteHandler } from "../../../lib/supabase-server";
import { getCurrentUser } from "../../../lib/get-current-user";
import { logAction, AUDIT_ACTIONS } from "../../../lib/audit";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  let clinicId = url.searchParams.get("clinic_id");
  const headerClinicId = request.headers.get("x-clinic-id");
  if (headerClinicId && clinicId && headerClinicId !== clinicId) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado a esta clínica." }, { status: 403 });
  }
  if (!clinicId) clinicId = headerClinicId;
  const q = url.searchParams.get("q")?.trim() || "";
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
  const limit = Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1);

  if (!clinicId) return badRequest("Parâmetro 'clinic_id' é obrigatório.");

  let query = supabase
    .from("patients")
    .select("id, clinic_id, full_name, phone, email, tags, created_at, blocked, birth_date", { count: "exact" })
    .eq("clinic_id", clinicId);

  if (q) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);

  const { data, error, count } = await query
    .order("full_name", { ascending: true })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ message: "Falha ao listar pacientes." }, { status: 500 });

  const list = (data ?? []) as Array<{ id: string; created_at?: string }>;
  const ids = list.map((p) => p.id);
  if (ids.length === 0) {
    return NextResponse.json({
      patients: list.map((p) => ({ ...p, appointments_count: 0, last_appointment_at: null, computed_tags: [] })),
      total: count ?? 0,
      page,
      totalPages: count === 0 ? 0 : Math.ceil((count ?? 0) / limit),
    });
  }

  const { data: appData } = await supabase
    .from("appointments")
    .select("patient_id, starts_at")
    .eq("clinic_id", clinicId)
    .neq("status", "cancelled");

  const appList = (appData ?? []) as Array<{ patient_id: string; starts_at: string }>;
  const countByPatient: Record<string, number> = {};
  const lastByPatient: Record<string, string> = {};
  for (const a of appList) {
    countByPatient[a.patient_id] = (countByPatient[a.patient_id] ?? 0) + 1;
    if (!lastByPatient[a.patient_id] || a.starts_at > lastByPatient[a.patient_id]) {
      lastByPatient[a.patient_id] = a.starts_at;
    }
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const withStats = list.map((p) => {
    const created = (p as { created_at?: string }).created_at;
    const appointmentsCount = countByPatient[p.id] ?? 0;
    const lastAt = lastByPatient[p.id] ?? null;
    const computedTags: string[] = [];
    if (created && created >= thirtyDaysAgo) computedTags.push("novo");
    if (appointmentsCount >= 5) computedTags.push("vip");
    else if (appointmentsCount >= 3) computedTags.push("recorrente");
    if (!lastAt || lastAt < ninetyDaysAgo) computedTags.push("inativo");
    return {
      ...p,
      appointments_count: appointmentsCount,
      last_appointment_at: lastAt,
      computed_tags: computedTags,
    };
  });

  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return NextResponse.json({
    patients: withStats,
    total,
    page,
    totalPages,
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  if (!body || typeof body !== "object") {
    return badRequest("Corpo da requisição inválido.");
  }

  const clinic_id = body.clinic_id as string | undefined;
  const full_name = body.full_name as string | undefined;
  const phone = body.phone as string | undefined;
  const email = body.email as string | undefined | null;
  const tags = body.tags;
  const birth_date = body.birth_date as string | undefined | null;

  const headerClinicId = request.headers.get("x-clinic-id");
  if (headerClinicId && clinic_id && headerClinicId !== clinic_id) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado a esta clínica." }, { status: 403 });
  }

  if (!clinic_id || !full_name?.trim() || !phone?.trim()) {
    return badRequest("Campos obrigatórios: 'clinic_id', 'full_name', 'phone'.");
  }

  let tagsArray: string[] = [];
  if (Array.isArray(tags)) {
    tagsArray = tags.map((t: unknown) => String(t).trim()).filter(Boolean);
  } else if (typeof tags === "string") {
    tagsArray = tags.split(",").map((t) => t.trim()).filter(Boolean);
  }

  const cookieStore = createCookieStoreForRouteHandler(request);
  const currentUser = await getCurrentUser(cookieStore);

  try {
    const { data, error } = await supabase
      .from("patients")
      .insert({
        clinic_id,
        full_name: full_name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        tags: tagsArray,
        birth_date: birth_date?.trim() ? birth_date.slice(0, 10) : null,
      })
      .select("id, clinic_id, full_name, phone, email, tags, birth_date")
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao criar paciente:", error);
      return NextResponse.json(
        { error: "database_error", message: "Falha ao criar paciente." },
        { status: 500 },
      );
    }

    if (currentUser) {
      await logAction({
        clinic_id: currentUser.clinic_id,
        user_id: currentUser.user_id,
        user_name: currentUser.user_name,
        user_email: currentUser.user_email,
        action: AUDIT_ACTIONS.PATIENT_CREATED,
        entity_type: "patient",
        entity_id: (data as { id: string }).id,
        details: {
          patient_id: (data as { id: string }).id,
          full_name: full_name.trim(),
          phone: phone.trim(),
        },
      });
    }

    const res = NextResponse.json({ patient: data }, { status: 201 });
    cookieStore.appendCookiesToResponse(res);
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/patients POST:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao criar o paciente.",
      },
      { status: 500 },
    );
  }
}