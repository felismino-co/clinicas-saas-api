import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  const dateParam = url.searchParams.get("date");

  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  const d = dateParam ? new Date(dateParam + "T12:00:00") : new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  const { data: rows, error } = await supabase
    .from("patients")
    .select("id, full_name, phone, birth_date")
    .eq("clinic_id", clinicId)
    .not("birth_date", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const patients = (rows ?? []).filter((p: { birth_date?: string | null }) => {
    if (!p.birth_date) return false;
    const b = new Date(p.birth_date + "T12:00:00");
    return b.getMonth() + 1 === month && b.getDate() === day;
  }).map((p: { id: string; full_name: string | null; phone: string | null; birth_date: string }) => {
    const b = new Date(p.birth_date + "T12:00:00");
    const today = new Date();
    let age = today.getFullYear() - b.getFullYear();
    const m = today.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
    return {
      id: p.id,
      full_name: p.full_name,
      phone: p.phone,
      birth_date: p.birth_date,
      age: age >= 0 ? age : null,
    };
  });

  return NextResponse.json({ patients });
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  let body: { send_messages?: boolean };
  try {
    body = (await request.json()) as { send_messages?: boolean };
  } catch {
    body = {};
  }

  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();

  const { data: rows } = await supabase
    .from("patients")
    .select("id, full_name, phone, birth_date")
    .eq("clinic_id", clinicId)
    .not("birth_date", "is", null);

  const birthdayPatients = (rows ?? []).filter((p: { birth_date?: string | null }) => {
    if (!p.birth_date) return false;
    const b = new Date(p.birth_date + "T12:00:00");
    return b.getMonth() + 1 === month && b.getDate() === day;
  });

  const { data: clinicRow } = await supabase
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .single();

  const clinicName = (clinicRow as { name?: string } | null)?.name ?? "Nossa clínica";

  if (body.send_messages && birthdayPatients.length > 0) {
    const n8nUrl = process.env.N8N_WEBHOOK_URL;
    const messageTemplate = (nome: string) =>
      `Feliz aniversário, ${nome}! 🎉 A ${clinicName} te deseja um dia incrível! Que tal agendar uma consulta em comemoração? Temos condição especial para você hoje 😊`;

    for (const p of birthdayPatients as { id: string; full_name: string | null; phone: string | null }[]) {
      if (p.phone) {
        try {
          if (n8nUrl) {
            await fetch(n8nUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone: p.phone.replace(/\D/g, ""),
                message: messageTemplate(p.full_name || "você"),
                type: "birthday",
                patient_id: p.id,
              }),
            });
          }
        } catch {
          // ignore single failure
        }
      }
    }
  }

  return NextResponse.json({
    sent: body.send_messages ? birthdayPatients.length : 0,
    count: birthdayPatients.length,
  });
}
