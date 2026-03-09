import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");

  if (!clinicId) return badRequest("clinic_id é obrigatório.");

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
    .select("id, provider_id, type, value, service_id")
    .eq("clinic_id", clinicId);

  const ruleByProvider = new Map<string | null, { type: string; value: number; service_id: string | null }>();
  (rules ?? []).forEach((r: { provider_id: string; type: string; value: number; service_id?: string | null }) => {
    const key = r.provider_id;
    if (!ruleByProvider.has(key) || !r.service_id) {
      ruleByProvider.set(key, { type: r.type, value: Number(r.value), service_id: r.service_id ?? null });
    }
  });

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, provider_id, service_id, status")
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

  const providerStats: Record<
    string,
    { provider_id: string; name: string; specialty: string | null; appointments_count: number; revenue: number; commission: number }
  > = {};

  (providers ?? []).forEach((p: { id: string; full_name: string | null; specialty?: string | null }) => {
    providerStats[p.id] = {
      provider_id: p.id,
      name: p.full_name ?? "",
      specialty: p.specialty ?? null,
      appointments_count: 0,
      revenue: 0,
      commission: 0,
    };
  });

  (appointments ?? []).forEach((a: { provider_id: string | null; service_id: string | null }) => {
    if (!a.provider_id) return;
    const stat = providerStats[a.provider_id];
    if (!stat) return;
    stat.appointments_count += 1;
    const price = a.service_id ? priceByService.get(a.service_id) ?? 0 : 0;
    stat.revenue += price;
  });

  const result = Object.values(providerStats).map((stat) => {
    const rule = ruleByProvider.get(stat.provider_id);
    let commission = 0;
    let rule_type: string | null = null;
    let rule_value: number | null = null;
    if (rule) {
      rule_type = rule.type;
      rule_value = rule.value;
      if (rule.type === "percentage") {
        commission = stat.revenue * (rule.value / 100);
      } else {
        commission = stat.appointments_count * rule.value;
      }
    }
    return { ...stat, commission, rule_type, rule_value };
  });

  return NextResponse.json({ providers: result, month: m, year: y });
}

type PostBody = {
  clinic_id: string;
  provider_id: string;
  type: "percentage" | "fixed";
  value: number;
  service_id?: string | null;
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return badRequest("Payload inválido.");
  }

  const { clinic_id, provider_id, type, value, service_id } = body;
  if (!clinic_id || !provider_id || !type || value === undefined) {
    return badRequest("clinic_id, provider_id, type e value são obrigatórios.");
  }
  if (type !== "percentage" && type !== "fixed") {
    return badRequest("type deve ser 'percentage' ou 'fixed'.");
  }
  if (type === "percentage" && (value < 0 || value > 100)) {
    return badRequest("Para percentage, value deve ser entre 0 e 100.");
  }
  if (type === "fixed" && value < 0) {
    return badRequest("Para fixed, value deve ser >= 0.");
  }

  const { data: existing } = await supabase
    .from("commission_rules")
    .select("id")
    .eq("clinic_id", clinic_id)
    .eq("provider_id", provider_id)
    .is("service_id", service_id ?? null)
    .maybeSingle();

  const payload = {
    clinic_id,
    provider_id,
    type,
    value: Number(value),
    service_id: service_id ?? null,
  };

  if (existing) {
    const { error } = await supabase
      .from("commission_rules")
      .update(payload)
      .eq("id", (existing as { id: string }).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("commission_rules").insert(payload as Record<string, unknown>);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
