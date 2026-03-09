import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const MAX_PATIENTS = 50;

async function sendN8n(phone: string, message: string, clinicId: string): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, clinic_id: clinicId, type: "reactivation" }),
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
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const iso90 = ninetyDaysAgo.toISOString();

    const { data: appointments } = await supabase
      .from("appointments")
      .select("patient_id")
      .eq("clinic_id", clinicId)
      .gte("starts_at", iso90);

    const activePatientIds = new Set(
      (appointments ?? []).map((a: { patient_id: string }) => a.patient_id),
    );

    const { data: allPatients } = await supabase
      .from("patients")
      .select("id, full_name, phone")
      .eq("clinic_id", clinicId);

    const inactive = (allPatients ?? []).filter(
      (p: { id: string; full_name?: string; phone?: string }) =>
        !activePatientIds.has(p.id) && p.phone,
    );

    const toSend = inactive.slice(0, MAX_PATIENTS);
    let sent = 0;
    for (const p of toSend) {
      const patient = p as { full_name?: string; phone: string };
      const nome = patient.full_name ?? "paciente";
      const message = `Olá ${nome}! Sentimos sua falta. Que tal agendar uma consulta? Estamos à disposição.`;
      await sendN8n(patient.phone, message, clinicId);
      sent++;
    }

    return NextResponse.json({ sent, total_eligible: inactive.length, success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao processar reativação." },
      { status: 500 },
    );
  }
}
