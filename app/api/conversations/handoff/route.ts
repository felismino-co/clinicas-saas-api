import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

type HandoffRequest = {
  clinic_id: string;
  conversation_id: string;
  reason: string;
  assigned_to_user_id?: string | null;
};

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  let body: HandoffRequest;

  try {
    body = (await request.json()) as HandoffRequest;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic_id, conversation_id, reason, assigned_to_user_id } = body;

  if (!clinic_id || !conversation_id) {
    return badRequest(
      "Campos 'clinic_id' e 'conversation_id' são obrigatórios.",
    );
  }

  const reasonText =
    typeof reason === "string" && reason.trim() ? reason.trim() : "Handoff solicitado";

  try {
    const { data, error } = await supabase
      .from("conversations")
      .update({
        needs_human: true,
        handoff_reason: reasonText,
        assigned_to_user_id: assigned_to_user_id ?? null,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", conversation_id)
      .eq("clinic_id", clinic_id)
      .select("id, clinic_id, patient_id, whatsapp_from, needs_human, handoff_reason, assigned_to_user_id, last_activity_at")
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao registrar handoff:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao registrar handoff na conversa.",
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error: "not_found",
          message: "Conversa não encontrada para esta clínica.",
        },
        { status: 404 },
      );
    }

    // Notificação à recepção: o painel pode listar conversas com needs_human=true.
    // Opcional: disparar webhook N8n ou push aqui quando existir integração.
    // await notifyReception(clinic_id, data);

    return NextResponse.json(
      {
        ok: true,
        conversation: data,
        message: "Conversa marcada para atendimento humano. Recepção pode ser notificada via painel ou webhook.",
      },
      { status: 200 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/conversations/handoff:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao registrar o handoff.",
      },
      { status: 500 },
    );
  }
}
