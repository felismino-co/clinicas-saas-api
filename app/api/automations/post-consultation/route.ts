import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

async function sendN8n(phone: string, message: string, clinicId: string): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, clinic_id: clinicId }),
    });
  } catch {
    // ignore
  }
}

export async function POST(request: NextRequest) {
  let body: { clinic_id?: string };
  try {
    body = (await request.json()) as { clinic_id?: string };
  } catch {
    body = {};
  }
  const clinicId = body.clinic_id?.trim();
  if (!clinicId) {
    return NextResponse.json(
      { error: "bad_request", message: "clinic_id é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgoEnd = new Date(now.getTime() - (7 * 24 - 1) * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgoEnd = new Date(now.getTime() - (30 * 24 - 1) * 60 * 60 * 1000).toISOString();

    let sent = 0;

    const { data: list2h } = await supabase
      .from("appointments")
      .select("id, patients(phone, full_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .lte("ends_at", oneHourAgo)
      .gte("ends_at", threeHoursAgo)
      .or("post_consultation_sent.is.null,post_consultation_sent.eq.false");

    for (const a of list2h ?? []) {
      const row = a as { id: string; patients: Array<{ phone?: string; full_name?: string }> | { phone?: string; full_name?: string } };
      const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
      const phone = patient?.phone;
      if (!phone) continue;
      const nome = patient?.full_name ?? "paciente";
      await sendN8n(phone, `Olá ${nome}! Como foi sua consulta? Estamos à disposição.`, clinicId);
      await supabase.from("appointments").update({ post_consultation_sent: true } as Record<string, unknown>).eq("id", row.id);
      sent++;
    }

    const { data: list7d } = await supabase
      .from("appointments")
      .select("id, patients(phone, full_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .lte("ends_at", sevenDaysAgoEnd)
      .gte("ends_at", sevenDaysAgo);

    for (const a of list7d ?? []) {
      const row = a as { id: string; patients: Array<{ phone?: string; full_name?: string }> | { phone?: string; full_name?: string } };
      const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
      const phone = patient?.phone;
      if (!phone) continue;
      const nome = patient?.full_name ?? "paciente";
      await sendN8n(phone, `Olá ${nome}! Tudo bem após a consulta?`, clinicId);
      sent++;
    }

    const { data: list30d } = await supabase
      .from("appointments")
      .select("id, patients(phone, full_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "completed")
      .lte("ends_at", thirtyDaysAgoEnd)
      .gte("ends_at", thirtyDaysAgo);

    for (const a of list30d ?? []) {
      const row = a as { id: string; patients: Array<{ phone?: string; full_name?: string }> | { phone?: string; full_name?: string } };
      const patient = Array.isArray(row.patients) ? row.patients[0] : row.patients;
      const phone = patient?.phone;
      if (!phone) continue;
      const nome = patient?.full_name ?? "paciente";
      await sendN8n(phone, `Olá ${nome}! Que tal agendar um retorno? Estamos à disposição.`, clinicId);
      sent++;
    }

    return NextResponse.json({ sent, success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao processar pós-consulta." },
      { status: 500 },
    );
  }
}
