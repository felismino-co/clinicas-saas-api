import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const MRR_PER_CLINIC = 297;

export async function GET() {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const isoMonth = startOfMonth.toISOString();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const isoFrom = sevenDaysAgo.toISOString();

    const [clinicsAll, patientsRes, appointmentsMonthRes, appointmentsWeekRes] = await Promise.all([
      supabase.from("clinics").select("id, name"),
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("appointments").select("clinic_id").gte("starts_at", isoMonth),
      supabase.from("appointments").select("id, starts_at").gte("starts_at", isoFrom),
    ]);

    const clinics = (clinicsAll.data ?? []) as { id: string; name: string; active?: boolean }[];
    const totalPatients = patientsRes.count ?? 0;
    const totalClinics = clinics.length;
    const activeClinics = clinics.filter((c) => (c as { active?: boolean }).active !== false).length;
    const inactiveClinics = totalClinics - activeClinics;

    const monthAppointments = appointmentsMonthRes.data ?? [];
    const clinicCountMonth: Record<string, number> = {};
    (monthAppointments as { clinic_id: string }[]).forEach((r) => {
      clinicCountMonth[r.clinic_id] = (clinicCountMonth[r.clinic_id] ?? 0) + 1;
    });
    const totalAppointmentsMonth = monthAppointments.length;

    const byDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = 0;
    }
    ((appointmentsWeekRes.data ?? []) as { starts_at: string }[]).forEach((a) => {
      const key = a.starts_at.slice(0, 10);
      if (byDay[key] !== undefined) byDay[key]++;
    });
    const appointmentsPerDay = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    const topClinicIds = Object.entries(clinicCountMonth)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id);
    const byId = clinics.reduce((acc: Record<string, string>, c) => {
      acc[c.id] = c.name ?? "";
      return acc;
    }, {});
    const topClinics = topClinicIds.map((id) => ({
      id,
      name: byId[id] ?? id,
      count: clinicCountMonth[id] ?? 0,
    }));

    const mrrEstimated = activeClinics * MRR_PER_CLINIC;
    const npsSimulated = 72;

    return NextResponse.json(
      {
        totalClinics,
        activeClinics,
        inactiveClinics,
        totalPatients,
        totalAppointmentsMonth,
        appointmentsPerDay,
        topClinics,
        mrrEstimated,
        churnCount: inactiveClinics,
        npsSimulated,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar métricas." },
      { status: 500 },
    );
  }
}
