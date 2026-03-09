import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const PAGE_SIZE = 20;
const STATUS_VALUES = ["lead", "interested", "scheduled", "patient", "inactive"] as const;

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const status = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);

  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  try {
    let query = supabase
      .from("contacts")
      .select("id, clinic_id, patient_id, phone, full_name, first_contact_at, last_contact_at, is_first_time, status, source, tags, notes, created_at", { count: "exact" })
      .eq("clinic_id", clinicId)
      .order("last_contact_at", { ascending: false });

    if (status && status !== "all" && STATUS_VALUES.includes(status as (typeof STATUS_VALUES)[number])) {
      query = query.eq("status", status);
    }

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const { data: rows, error, count } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) {
      return NextResponse.json({ error: "database_error", message: error.message }, { status: 500 });
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    const contacts = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      clinic_id: r.clinic_id,
      patient_id: r.patient_id,
      phone: r.phone,
      full_name: r.full_name ?? "",
      first_contact_at: r.first_contact_at,
      last_contact_at: r.last_contact_at,
      is_first_time: r.is_first_time === true,
      status: r.status ?? "lead",
      source: r.source ?? "whatsapp",
      tags: Array.isArray(r.tags) ? r.tags : [],
      notes: r.notes ?? "",
      created_at: r.created_at,
    }));

    return NextResponse.json({ contacts, total, totalPages });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao listar contatos." },
      { status: 500 },
    );
  }
}
