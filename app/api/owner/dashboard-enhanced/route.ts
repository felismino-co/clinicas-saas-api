import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const monthParam = url.searchParams.get("month");
  const yearParam = url.searchParams.get("year");

  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  const now = new Date();
  const year = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : now.getMonth() + 1;
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);
  const startPrev = new Date(year, month - 2, 1);
  const endPrev = new Date(year, month - 1, 0, 23, 59, 59, 999);

  try {
    const { data: clinicRow } = await supabase
      .from("clinics")
      .select("id, settings")
      .eq("id", clinicId)
      .maybeSingle();

    const settings = (clinicRow as { settings?: { monthly_goal?: number } } | null)?.settings ?? {};
    const monthlyGoal = typeof settings.monthly_goal === "number" ? settings.monthly_goal : 10000;

    const { data: completedAppointments } = await supabase
      .from("appointments")
      .select("id, service_id")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .gte("starts_at", startOfMonth.toISOString())
      .lte("starts_at", endOfMonth.toISOString());

    let revenue = 0;
    const serviceIds = (completedAppointments ?? [])
      .map((a: { service_id: string | null }) => a.service_id)
      .filter(Boolean) as string[];
    if (serviceIds.length > 0) {
      const { data: services } = await supabase
        .from("services")
        .select("id, price")
        .in("id", [...new Set(serviceIds)]);
      const priceByService: Record<string, number> = {};
      (services ?? []).forEach((s: { id: string; price: unknown }) => {
        priceByService[s.id] = Number(s.price) || 0;
      });
      (completedAppointments ?? []).forEach((a: { service_id: string | null }) => {
        revenue += a.service_id ? (priceByService[a.service_id] ?? 0) : 0;
      });
    }

    const appointmentsCount = (completedAppointments ?? []).length;

    const { data: allPatientsInPeriod } = await supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", startOfMonth.toISOString())
      .lte("starts_at", endOfMonth.toISOString());

    const patientAppointmentCount: Record<string, number> = {};
    (allPatientsInPeriod ?? []).forEach((a: { patient_id: string | null }) => {
      if (a.patient_id) {
        patientAppointmentCount[a.patient_id] = (patientAppointmentCount[a.patient_id] ?? 0) + 1;
      }
    });
    const totalPatients = Object.keys(patientAppointmentCount).length;
    const returningPatients = Object.values(patientAppointmentCount).filter((c) => c >= 2).length;
    const returnRate = totalPatients > 0 ? Math.round((returningPatients / totalPatients) * 100) : 0;

    const averageTicket = appointmentsCount > 0 ? Math.round((revenue / appointmentsCount) * 100) / 100 : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const { data: last7Appointments } = await supabase
      .from("appointments")
      .select("id, starts_at, status")
      .eq("clinic_id", clinicId)
      .gte("starts_at", sevenDaysAgo.toISOString());

    const last7days: { date: string; total: number; confirmed: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      last7days.push({ date: key, total: 0, confirmed: 0 });
    }
    (last7Appointments ?? []).forEach((a: { starts_at: string; status: string }) => {
      const key = a.starts_at.slice(0, 10);
      const day = last7days.find((x) => x.date === key);
      if (day) {
        day.total += 1;
        if (a.status === "confirmed" || a.status === "completed") day.confirmed += 1;
      }
    });

    const { data: monthAppointmentsForServices } = await supabase
      .from("appointments")
      .select("service_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", startOfMonth.toISOString())
      .lte("starts_at", endOfMonth.toISOString());

    const serviceCount: Record<string, number> = {};
    (monthAppointmentsForServices ?? []).forEach((a: { service_id: string | null }) => {
      const id = a.service_id ?? "_none_";
      if (id !== "_none_") serviceCount[id] = (serviceCount[id] ?? 0) + 1;
    });
    const topServiceIds = Object.entries(serviceCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id);

    let topServices: { id: string; name: string; count: number }[] = [];
    if (topServiceIds.length > 0) {
      const { data: servicesList } = await supabase
        .from("services")
        .select("id, name")
        .in("id", topServiceIds);
      const byId = (servicesList ?? []).reduce((acc: Record<string, string>, s: { id: string; name: string | null }) => {
        acc[s.id] = s.name ?? "Serviço";
        return acc;
      }, {});
      topServices = topServiceIds.map((id) => ({
        id,
        name: byId[id] ?? id,
        count: serviceCount[id] ?? 0,
      }));
    }

    const { data: prevMonthCompleted } = await supabase
      .from("appointments")
      .select("id, service_id")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .gte("starts_at", startPrev.toISOString())
      .lte("starts_at", endPrev.toISOString());

    let prevRevenue = 0;
    const prevServiceIds = (prevMonthCompleted ?? []).map((a: { service_id: string | null }) => a.service_id).filter(Boolean) as string[];
    if (prevServiceIds.length > 0) {
      const { data: prevServices } = await supabase.from("services").select("id, price").in("id", [...new Set(prevServiceIds)]);
      const prevPriceByService: Record<string, number> = {};
      (prevServices ?? []).forEach((s: { id: string; price: unknown }) => {
        prevPriceByService[s.id] = Number(s.price) || 0;
      });
      (prevMonthCompleted ?? []).forEach((a: { service_id: string | null }) => {
        prevRevenue += a.service_id ? (prevPriceByService[a.service_id] ?? 0) : 0;
      });
    }

    const prevAppointmentsCount = (prevMonthCompleted ?? []).length;
    const { data: prevPatients } = await supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", startPrev.toISOString())
      .lte("starts_at", endPrev.toISOString());
    const prevPatientCount: Record<string, number> = {};
    (prevPatients ?? []).forEach((a: { patient_id: string | null }) => {
      if (a.patient_id) prevPatientCount[a.patient_id] = (prevPatientCount[a.patient_id] ?? 0) + 1;
    });
    const prevTotalPatients = Object.keys(prevPatientCount).length;
    const prevReturning = Object.values(prevPatientCount).filter((c) => c >= 2).length;
    const prevReturnRate = prevTotalPatients > 0 ? Math.round((prevReturning / prevTotalPatients) * 100) : 0;

    const trends = {
      revenue: prevRevenue === 0 ? 0 : Math.round(((revenue - prevRevenue) / prevRevenue) * 100),
      appointments: prevAppointmentsCount === 0 ? 0 : Math.round(((appointmentsCount - prevAppointmentsCount) / prevAppointmentsCount) * 100),
      returnRate: prevReturnRate === 0 ? 0 : returnRate - prevReturnRate,
    };

    const today = new Date().toISOString().slice(0, 10);
    const startOfToday = `${today}T00:00:00.000Z`;
    const endOfToday = `${today}T23:59:59.999Z`;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [{ count: todayTotal }, { count: weekTotal }, { count: patientsTotal }, { count: todayConfirmed }] = await Promise.all([
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).gte("starts_at", startOfToday).lte("starts_at", endOfToday),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).gte("starts_at", weekAgo.toISOString()),
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("status", "confirmed").gte("starts_at", startOfToday).lte("starts_at", endOfToday),
    ]);

    const confirmationRate = (todayTotal ?? 0) > 0 ? Math.round(((todayConfirmed ?? 0) / (todayTotal ?? 1)) * 100) : 0;

    const { data: convs } = await supabase.from("conversations").select("id").eq("clinic_id", clinicId);
    const convIds = (convs ?? []).map((c: { id: string }) => c.id);
    let messagesToday = 0;
    if (convIds.length > 0) {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .gte("created_at", startOfToday)
        .lte("created_at", endOfToday);
      messagesToday = count ?? 0;
    }

    const { data: convList } = await supabase.from("conversations").select("id, needs_human, status").eq("clinic_id", clinicId);
    const activeConversations = (convList ?? []).filter((c: { needs_human?: boolean; status?: string }) => c.needs_human === false && c.status === "open").length;

    return NextResponse.json({
      revenue,
      monthlyGoal,
      returnRate,
      averageTicket,
      last7days,
      topServices,
      trends,
      todayAppointments: todayTotal ?? 0,
      weekAppointments: weekTotal ?? 0,
      patientsTotal: patientsTotal ?? 0,
      confirmationRate,
      messagesToday: Number(messagesToday),
      activeConversations: Number(activeConversations),
      whatsappStatus: "connected",
      appointmentsPerDay: last7days.map((d) => ({ date: d.date, count: d.total })),
      topProviders: [],
      recentActivity: [],
    });
  } catch (err) {
    console.error("Erro dashboard-enhanced:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar dashboard." },
      { status: 500 },
    );
  }
}
