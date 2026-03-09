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
  let clinicId = url.searchParams.get("clinic_id");
  const headerClinicId = request.headers.get("x-clinic-id");
  if (headerClinicId && clinicId && headerClinicId !== clinicId) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado a esta clínica." }, { status: 403 });
  }
  if (!clinicId) clinicId = headerClinicId;

  if (!clinicId) {
    return badRequest("Parâmetro 'clinic_id' é obrigatório.");
  }

  try {
    const { data, error } = await supabase
      .from("conversations")
      .select(
        "id, clinic_id, patient_id, whatsapp_from, last_activity_at, needs_human, patients (full_name, phone)",
      )
      .eq("clinic_id", clinicId)
      .order("last_activity_at", { ascending: false });

    if (error) {
      return NextResponse.json({ conversations: [] }, { status: 200 });
    }

    const list = (data ?? []).map((c: Record<string, unknown>) => {
      const patient = Array.isArray(c.patients) ? (c.patients[0] as Record<string, unknown>) : (c.patients as Record<string, unknown>);
      const whatsapp_from = (c.whatsapp_from ?? (patient?.phone as string) ?? "") as string;
      return {
        id: c.id,
        patient_id: c.patient_id,
        full_name: patient?.full_name ?? null,
        whatsapp_from,
        last_message: (c as { last_message?: string }).last_message ?? null,
        last_message_at: (c as { last_message_at?: string }).last_message_at ?? c.last_activity_at ?? null,
        status: ((c as { status?: string }).status ?? (c.needs_human ? "open" : "resolved")) as string,
        unread_count: Number((c as { unread_count?: number }).unread_count) || 0,
        needs_human: Boolean(c.needs_human),
      };
    });

    return NextResponse.json({ conversations: list }, { status: 200 });
  } catch {
    return NextResponse.json({ conversations: [] }, { status: 200 });
  }
}
