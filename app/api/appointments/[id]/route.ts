import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import { createCookieStoreForRouteHandler } from "../../../../lib/supabase-server";
import { getCurrentUser } from "../../../../lib/get-current-user";
import { logAction, AUDIT_ACTIONS } from "../../../../lib/audit";

const VALID_STATUSES = [
  "scheduled",
  "confirmed",
  "cancelled",
  "no_show",
  "completed",
] as const;

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

type PatchBody = {
  status?: string;
  starts_at?: string;
  ends_at?: string;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return badRequest("ID do agendamento é obrigatório.");
  }

  let body: PatchBody;

  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { status, starts_at, ends_at } = body;

  if (
    status === undefined &&
    starts_at === undefined &&
    ends_at === undefined
  ) {
    return badRequest(
      "É necessário informar ao menos um campo: 'status' ou 'starts_at'/'ends_at'.",
    );
  }

  if (status !== undefined) {
    if (typeof status !== "string") {
      return badRequest("Campo 'status' deve ser string.");
    }
    if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return badRequest(
        `'status' deve ser um de: ${VALID_STATUSES.join(", ")}.`,
      );
    }
  }

  const updateData: Record<string, unknown> = {};

  if (status !== undefined) {
    updateData.status = status;
  }

  if (starts_at !== undefined || ends_at !== undefined) {
    if (!starts_at || !ends_at) {
      return badRequest(
        "Para remarcar é obrigatório enviar 'starts_at' e 'ends_at'.",
      );
    }
    const starts = new Date(starts_at);
    const ends = new Date(ends_at);
    if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
      return badRequest(
        "'starts_at' e 'ends_at' devem ser datas válidas (ISO).",
      );
    }
    if (ends <= starts) {
      return badRequest("'ends_at' deve ser posterior a 'starts_at'.");
    }
    updateData.starts_at = starts_at;
    updateData.ends_at = ends_at;
  }

  const cookieStore = createCookieStoreForRouteHandler(request);
  const currentUser = await getCurrentUser(cookieStore);

  try {
    const { data: existing } = await supabase
      .from("appointments")
      .select("id, clinic_id, status, starts_at, ends_at, patients (full_name)")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("appointments")
      .update(updateData)
      .eq("id", id)
      .select(
        "id, clinic_id, patient_id, provider_id, service_id, starts_at, ends_at, status",
      )
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao atualizar agendamento:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao atualizar agendamento.",
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "not_found",
          message: "Agendamento não encontrado.",
        },
        { status: 404 },
      );
    }

    if (currentUser && existing) {
      const prev = existing as { status?: string; starts_at?: string; ends_at?: string; patients?: { full_name?: string } | null };
      const patientName = Array.isArray(prev.patients) ? prev.patients[0]?.full_name : prev.patients?.full_name;
      if (status !== undefined && status !== prev.status) {
        const action =
          status === "confirmed"
            ? AUDIT_ACTIONS.APPOINTMENT_CONFIRMED
            : status === "cancelled"
              ? AUDIT_ACTIONS.APPOINTMENT_CANCELLED
              : status === "no_show"
                ? AUDIT_ACTIONS.APPOINTMENT_NO_SHOW
                : null;
        if (action) {
          await logAction({
            clinic_id: currentUser.clinic_id,
            user_id: currentUser.user_id,
            user_name: currentUser.user_name,
            user_email: currentUser.user_email,
            action,
            entity_type: "appointment",
            entity_id: id,
            details: {
              appointment_id: id,
              patient_name: patientName,
              previous_status: prev.status,
              new_status: status,
            },
          });
        }
      }
      if (starts_at !== undefined && prev.starts_at !== starts_at) {
        await logAction({
          clinic_id: currentUser.clinic_id,
          user_id: currentUser.user_id,
          user_name: currentUser.user_name,
          user_email: currentUser.user_email,
          action: AUDIT_ACTIONS.APPOINTMENT_RESCHEDULED,
          entity_type: "appointment",
          entity_id: id,
          details: {
            appointment_id: id,
            patient_name: patientName,
            previous_starts_at: prev.starts_at,
            new_starts_at: starts_at,
            new_ends_at: ends_at,
          },
        });
      }
    }

    const res = NextResponse.json(data, { status: 200 });
    cookieStore.appendCookiesToResponse(res);
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/appointments/[id] PATCH:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao atualizar o agendamento.",
      },
      { status: 500 },
    );
  }
}
