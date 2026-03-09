import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const N8N_URL = process.env.N8N_WEBHOOK_URL;

async function sendN8n(phone: string, message: string, clinicId: string): Promise<void> {
  if (!N8N_URL) return;
  try {
    await fetch(N8N_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, clinic_id: clinicId }),
    });
  } catch {
    // ignore
  }
}

export async function POST(request: NextRequest) {
  let body: { campaign_id?: string };
  try {
    body = (await request.json()) as { campaign_id?: string };
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload inválido." },
      { status: 400 },
    );
  }
  const campaignId = body.campaign_id?.trim();
  if (!campaignId) {
    return NextResponse.json(
      { error: "bad_request", message: "campaign_id é obrigatório." },
      { status: 400 },
    );
  }

  try {
    const { data: campaign, error: campErr } = await supabase
      .from("campaigns")
      .select("id, clinic_id, segment, message_template, status")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      return NextResponse.json(
        { error: "not_found", message: "Campanha não encontrada." },
        { status: 404 },
      );
    }

    const c = campaign as { clinic_id: string; segment: string; message_template: string; status: string };
    if (c.status === "sent") {
      return NextResponse.json(
        { error: "already_sent", message: "Campanha já foi enviada." },
        { status: 400 },
      );
    }

    const clinicId = c.clinic_id;
    const segment = c.segment;
    const template = c.message_template;

    let patientIds: string[] = [];

    if (segment === "todos") {
      const { data: list } = await supabase
        .from("patients")
        .select("id, blocked")
        .eq("clinic_id", clinicId);
      const rows = (list ?? []) as Array<{ id: string; blocked?: boolean }>;
      patientIds = rows.filter((r) => r.blocked !== true).map((r) => r.id);
    } else if (segment === "inativos") {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const iso90 = ninetyDaysAgo.toISOString();
      const { data: appointments } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("clinic_id", clinicId)
        .gte("starts_at", iso90);
      const activeIds = new Set((appointments ?? []).map((a: { patient_id: string }) => a.patient_id));
      const { data: all } = await supabase.from("patients").select("id, blocked").eq("clinic_id", clinicId);
      const allRows = (all ?? []) as Array<{ id: string; blocked?: boolean }>;
      patientIds = allRows.filter((r) => r.blocked !== true).map((r) => r.id).filter((id: string) => !activeIds.has(id));
    } else if (segment === "vip") {
      const { data: counts } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("clinic_id", clinicId)
        .neq("status", "cancelled");
      const byPatient: Record<string, number> = {};
      (counts ?? []).forEach((a: { patient_id: string }) => {
        byPatient[a.patient_id] = (byPatient[a.patient_id] ?? 0) + 1;
      });
      patientIds = Object.entries(byPatient)
        .filter(([, n]) => n >= 5)
        .map(([id]) => id);
      const { data: blockedList } = await supabase.from("patients").select("id, blocked").eq("clinic_id", clinicId);
      const blockedSet = new Set(
        (blockedList ?? []).filter((r: { blocked?: boolean }) => r.blocked === true).map((r: { id: string }) => r.id),
      );
      patientIds = patientIds.filter((id) => !blockedSet.has(id));
    } else {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const iso30 = thirtyDaysAgo.toISOString();
      const { data: list } = await supabase
        .from("patients")
        .select("id, blocked")
        .eq("clinic_id", clinicId)
        .gte("created_at", iso30);
      const rows = (list ?? []) as Array<{ id: string; blocked?: boolean }>;
      patientIds = rows.filter((r) => r.blocked !== true).map((r) => r.id);
    }

    const { data: patients } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .in("id", patientIds)
      .not("phone", "is", null);

    const list = (patients ?? []) as Array<{ id: string; full_name?: string | null; phone: string }>;
    let sentCount = 0;
    const clinicName = "nossa clínica";
    for (const p of list) {
      const msg = template
        .replace(/\{nome\}/gi, p.full_name ?? "paciente")
        .replace(/\{clinica\}/gi, clinicName);
      await sendN8n(p.phone, msg, clinicId);
      sentCount++;
    }

    const now = new Date().toISOString();
    await supabase
      .from("campaigns")
      .update({
        status: "sent",
        sent_at: now,
        total_sent: sentCount,
      } as Record<string, unknown>)
      .eq("id", campaignId);

    return NextResponse.json({ sent_count: sentCount, success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao enviar campanha." },
      { status: 500 },
    );
  }
}
