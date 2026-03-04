import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return badRequest("ID do agendamento é obrigatório.");
  }

  let body: { status?: string };

  try {
    body = (await request.json()) as { status?: string };
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { status } = body;
  if (status === undefined || typeof status !== "string") {
    return badRequest("Campo 'status' é obrigatório.");
  }

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return badRequest(
      `'status' deve ser um de: ${VALID_STATUSES.join(", ")}.`,
    );
  }

  try {
    const { data, error } = await supabase
      .from("appointments")
      .update({ status })
      .eq("id", id)
      .select("id, clinic_id, patient_id, starts_at, ends_at, status")
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

    return NextResponse.json(data, { status: 200 });
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
