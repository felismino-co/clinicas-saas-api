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

  if (!clinicId) {
    return badRequest("Parâmetro 'clinic_id' é obrigatório.");
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const startOfToday = `${today}T00:00:00.000Z`;
    const endOfToday = `${today}T23:59:59.999Z`;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfWeek = weekAgo.toISOString();

    const [
      todayRes,
      weekRes,
      patientsRes,
      todayConfirmedRes,
    ] = await Promise.all([
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("starts_at", startOfToday)
        .lte("starts_at", endOfToday),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("starts_at", startOfWeek),
      supabase
        .from("patients")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId),
      supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "confirmed")
        .gte("starts_at", startOfToday)
        .lte("starts_at", endOfToday),
    ]);

    const todayTotal = todayRes.count ?? 0;
    const weekTotal = weekRes.count ?? 0;
    const patientsTotal = patientsRes.count ?? 0;
    const todayConfirmed = todayConfirmedRes.count ?? 0;
    const confirmationRate =
      todayTotal > 0 ? Math.round((todayConfirmed / todayTotal) * 100) : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const isoFrom = sevenDaysAgo.toISOString();

    const { data: appointmentsByDay } = await supabase
      .from("appointments")
      .select("id, starts_at, provider_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", isoFrom);

    const byDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = 0;
    }
    (appointmentsByDay ?? []).forEach((a: { starts_at: string }) => {
      const key = a.starts_at.slice(0, 10);
      if (byDay[key] !== undefined) byDay[key]++;
    });
    const appointmentsPerDay = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const { data: monthAppointments } = await supabase
      .from("appointments")
      .select("provider_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", startOfMonth.toISOString());

    const providerCount: Record<string, number> = {};
    (monthAppointments ?? []).forEach((a: { provider_id: string | null }) => {
      const id = a.provider_id ?? "_sem_";
      providerCount[id] = (providerCount[id] ?? 0) + 1;
    });
    const topProviderIds = Object.entries(providerCount)
      .filter(([id]) => id !== "_sem_")
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);

    let topProviders: { id: string; full_name: string; count: number }[] = [];
    if (topProviderIds.length > 0) {
      const { data: providers } = await supabase
        .from("providers")
        .select("id, full_name")
        .in("id", topProviderIds);
      const byId = (providers ?? []).reduce((acc: Record<string, string>, p: { id: string; full_name: string | null }) => {
        acc[p.id] = p.full_name ?? "Sem nome";
        return acc;
      }, {});
      topProviders = topProviderIds.map((id) => ({
        id,
        full_name: byId[id] ?? id,
        count: providerCount[id] ?? 0,
      }));
    }

    return NextResponse.json(
      {
        todayTotal: Number(todayTotal),
        weekTotal: Number(weekTotal),
        patientsTotal: Number(patientsTotal),
        confirmationRate: Number(confirmationRate),
        appointmentsPerDay,
        topProviders,
      },
      { status: 200 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro em /api/owner/stats:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar estatísticas." },
      { status: 500 },
    );
  }
}
