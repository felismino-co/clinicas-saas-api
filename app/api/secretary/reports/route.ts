import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const dateParam = url.searchParams.get("date");

  if (!clinicId) return badRequest("Parâmetro clinic_id é obrigatório.");

  const date = dateParam || new Date().toISOString().slice(0, 10);
  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const startOfWeek = new Date(date);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const isoWeekStart = startOfWeek.toISOString().slice(0, 10) + "T00:00:00.000Z";
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  const isoWeekEnd = endOfWeek.toISOString().slice(0, 10) + "T23:59:59.999Z";

  const startOfMonth = new Date(date);
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const isoMonthStart = startOfMonth.toISOString();
  const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59, 999);
  const isoMonthEnd = endOfMonth.toISOString();

  try {
    const [dayRes, weekRes, monthRes, nextFiveRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, status")
        .eq("clinic_id", clinicId)
        .gte("starts_at", startOfDay)
        .lte("starts_at", endOfDay),
      supabase
        .from("appointments")
        .select("id")
        .eq("clinic_id", clinicId)
        .gte("starts_at", isoWeekStart)
        .lte("starts_at", isoWeekEnd),
      supabase
        .from("appointments")
        .select("patient_id")
        .eq("clinic_id", clinicId)
        .gte("starts_at", isoMonthStart)
        .lte("starts_at", isoMonthEnd),
      supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status, patients(full_name, phone), providers(full_name), services(name)")
        .eq("clinic_id", clinicId)
        .gte("starts_at", startOfDay)
        .lte("starts_at", endOfDay)
        .order("starts_at", { ascending: true })
        .limit(5),
    ]);

    const dayList = (dayRes.data ?? []) as { id: string; status: string }[];
    const dayTotal = dayList.length;
    const dayConfirmed = dayList.filter((a) => a.status === "confirmed").length;
    const dayCancelled = dayList.filter((a) => a.status === "cancelled").length;
    const dayNoShow = dayList.filter((a) => a.status === "no_show").length;

    const weekTotal = (weekRes.data ?? []).length;

    const monthList = (monthRes.data ?? []) as { patient_id: string }[];
    const uniquePatients = new Set(monthList.map((a) => a.patient_id).filter(Boolean));
    const patientsInMonth = uniquePatients.size;

    const nextFive = (nextFiveRes.data ?? []).map((a: Record<string, unknown>) => {
      const patient = Array.isArray(a.patients) ? (a.patients[0] as Record<string, unknown>) : (a.patients as Record<string, unknown>);
      const provider = Array.isArray(a.providers) ? (a.providers[0] as Record<string, unknown>) : (a.providers as Record<string, unknown>);
      const service = Array.isArray(a.services) ? (a.services[0] as Record<string, unknown>) : (a.services as Record<string, unknown>);
      return {
        id: a.id,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        status: a.status,
        patient_name: patient?.full_name ?? "—",
        patient_phone: patient?.phone ?? "—",
        provider_name: provider?.full_name ?? "—",
        service_name: service?.name ?? "—",
      };
    });

    return NextResponse.json(
      {
        date,
        dayStats: { total: dayTotal, confirmed: dayConfirmed, cancelled: dayCancelled, no_show: dayNoShow },
        weekTotal,
        patientsInMonth,
        nextAppointments: nextFive,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar relatórios." },
      { status: 500 },
    );
  }
}
