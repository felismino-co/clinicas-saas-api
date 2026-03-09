import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

async function sendN8n(phone: string, message: string, clinicId: string, payload: Record<string, unknown>): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, clinic_id: clinicId, ...payload }),
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
    const in47h = new Date(now.getTime() + 47 * 60 * 60 * 1000).toISOString();
    const in49h = new Date(now.getTime() + 49 * 60 * 60 * 1000).toISOString();
    const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data: list48 } = await supabase
      .from("appointments")
      .select("id, starts_at, patients(phone, full_name)")
      .eq("clinic_id", clinicId)
      .gte("starts_at", in47h)
      .lte("starts_at", in49h)
      .neq("status", "cancelled")
      .or("reminder_sent.is.null,reminder_sent.eq.false");

    const { data: list24 } = await supabase
      .from("appointments")
      .select("id, starts_at, patients(phone, full_name)")
      .eq("clinic_id", clinicId)
      .gte("starts_at", in23h)
      .lte("starts_at", in25h)
      .neq("status", "cancelled")
      .or("reminder_sent.is.null,reminder_sent.eq.false");

    const appointments48 = (list48 ?? []) as Array<{
      id: string;
      starts_at: string;
      patients: Array<{ phone?: string; full_name?: string }> | { phone?: string; full_name?: string };
    }>;
    const appointments24 = (list24 ?? []) as Array<{
      id: string;
      starts_at: string;
      patients: Array<{ phone?: string; full_name?: string }> | { phone?: string; full_name?: string };
    }>;

    let sent = 0;
    for (const a of appointments48) {
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const phone = patient?.phone;
      if (!phone) continue;
      const nome = patient?.full_name ?? "paciente";
      const dataHora = new Date(a.starts_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const message = `Olá ${nome}! Lembrete: você tem consulta agendada para ${dataHora}. Confirme sua presença.`;
      await sendN8n(phone, message, clinicId, { appointment_id: a.id, type: "reminder_48h" });
      await supabase.from("appointments").update({ reminder_sent: true } as Record<string, unknown>).eq("id", a.id);
      sent++;
    }
    for (const a of appointments24) {
      const patient = Array.isArray(a.patients) ? a.patients[0] : a.patients;
      const phone = patient?.phone;
      if (!phone) continue;
      const nome = patient?.full_name ?? "paciente";
      const dataHora = new Date(a.starts_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      const message = `Olá ${nome}! Amanhã você tem consulta às ${dataHora}. Estamos te esperando!`;
      await sendN8n(phone, message, clinicId, { appointment_id: a.id, type: "reminder_24h" });
      await supabase.from("appointments").update({ reminder_sent: true } as Record<string, unknown>).eq("id", a.id);
      sent++;
    }

    return NextResponse.json({ sent, success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao processar lembretes." },
      { status: 500 },
    );
  }
}
