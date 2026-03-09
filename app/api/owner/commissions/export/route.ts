import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../../lib/supabase";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");

  if (!clinicId) {
    return NextResponse.json({ error: "clinic_id é obrigatório." }, { status: 400 });
  }

  const now = new Date();
  const m = month ? parseInt(month, 10) : now.getMonth() + 1;
  const y = year ? parseInt(year, 10) : now.getFullYear();
  const startDate = `${y}-${String(m).padStart(2, "0")}-01T00:00:00.000Z`;
  const endDate = new Date(y, m, 0, 23, 59, 59, 999).toISOString();

  const { data: providers } = await supabase
    .from("providers")
    .select("id, full_name, specialty")
    .eq("clinic_id", clinicId)
    .order("full_name", { ascending: true });

  const { data: rules } = await supabase
    .from("commission_rules")
    .select("provider_id, type, value")
    .eq("clinic_id", clinicId);

  const ruleByProvider = new Map<string, { type: string; value: number }>();
  (rules ?? []).forEach((r: { provider_id: string; type: string; value: number }) => {
    ruleByProvider.set(r.provider_id, { type: r.type, value: Number(r.value) });
  });

  const { data: appointments } = await supabase
    .from("appointments")
    .select("provider_id, service_id")
    .eq("clinic_id", clinicId)
    .eq("status", "completed")
    .gte("starts_at", startDate)
    .lte("starts_at", endDate);

  const { data: services } = await supabase
    .from("services")
    .select("id, price")
    .eq("clinic_id", clinicId);

  const priceByService = new Map<string, number>();
  (services ?? []).forEach((s: { id: string; price?: number | null }) => {
    priceByService.set(s.id, Number(s.price) || 0);
  });

  const providerStats: Record<string, { name: string; specialty: string | null; count: number; revenue: number; commission: number }> = {};

  (providers ?? []).forEach((p: { id: string; full_name: string | null; specialty?: string | null }) => {
    providerStats[p.id] = { name: p.full_name ?? "", specialty: p.specialty ?? null, count: 0, revenue: 0, commission: 0 };
  });

  (appointments ?? []).forEach((a: { provider_id: string | null; service_id: string | null }) => {
    if (!a.provider_id) return;
    const stat = providerStats[a.provider_id];
    if (!stat) return;
    stat.count += 1;
    stat.revenue += a.service_id ? priceByService.get(a.service_id) ?? 0 : 0;
  });

  const rows = Object.entries(providerStats).map(([providerId, stat]) => {
    const rule = ruleByProvider.get(providerId);
    let commission = 0;
    if (rule) {
      commission = rule.type === "percentage" ? stat.revenue * (rule.value / 100) : stat.count * rule.value;
    }
    return { ...stat, commission };
  });

  const BOM = "\uFEFF";
  const header = "Médico;Especialidade;Consultas;Receita Total;Comissão\n";
  const csvRows = rows.map(
    (r) =>
      `"${String(r.name).replace(/"/g, '""')}";"${String(r.specialty ?? "").replace(/"/g, '""')}";${r.count};${r.revenue.toFixed(2)};${r.commission.toFixed(2)}`,
  );
  const csv = BOM + header + csvRows.join("\n");

  const filename = `comissoes-${String(m).padStart(2, "0")}-${y}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
