import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const headerClinicId = request.headers.get("x-clinic-id");
  const userId = url.searchParams.get("user_id");
  const action = url.searchParams.get("action");
  const period = url.searchParams.get("period");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

  const effectiveClinicId = clinicId ?? headerClinicId;
  if (!effectiveClinicId) {
    return NextResponse.json({ error: "clinic_id é obrigatório." }, { status: 400 });
  }
  if (headerClinicId && clinicId && headerClinicId !== clinicId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let startDate: string | null = null;
  if (period === "today") {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    startDate = d.toISOString();
  } else if (period === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString();
  } else if (period === "month") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    startDate = d.toISOString();
  }

  let query = supabase
    .from("audit_log")
    .select("id, clinic_id, user_id, user_name, user_email, action, entity_type, entity_id, details, created_at", { count: "exact" })
    .eq("clinic_id", effectiveClinicId)
    .order("created_at", { ascending: false });

  if (userId) query = query.eq("user_id", userId);
  if (action) query = query.eq("action", action);
  if (startDate) query = query.gte("created_at", startDate);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data: logs, error, count } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return NextResponse.json({
    logs: logs ?? [],
    total,
    totalPages,
  });
}
