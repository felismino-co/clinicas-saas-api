import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

type WhatsappChannelRow = {
  id: string;
  clinic_id: string;
  phone_number: string;
  provider: string;
  external_instance_id: string | null;
  token: string | null;
  active: boolean;
};

type SendWhatsappRequest = {
  clinic_id: string;
  to: string;
  channel_id: string;
  type: "text";
  text: string;
  conversation_id?: string;
  patient_id?: string;
};

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  const zapiBaseUrl = process.env.ZAPI_BASE_URL;

  if (!zapiBaseUrl) {
    return NextResponse.json(
      {
        error: "server_config_error",
        message: "ZAPI_BASE_URL não configurada no servidor.",
      },
      { status: 500 },
    );
  }

  let body: SendWhatsappRequest;

  try {
    body = (await request.json()) as SendWhatsappRequest;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic_id, to, channel_id, type, text } = body;

  if (!clinic_id || !to || !channel_id || !type) {
    return badRequest(
      "Campos 'clinic_id', 'to', 'channel_id' e 'type' são obrigatórios.",
    );
  }

  if (type !== "text") {
    return badRequest("Atualmente apenas mensagens de texto são suportadas.");
  }

  if (!text || typeof text !== "string") {
    return badRequest("Campo 'text' é obrigatório para mensagens de texto.");
  }

  try {
    const { data, error } = await supabase
      .from("whatsapp_channels")
      .select("*")
      .eq("id", channel_id)
      .eq("clinic_id", clinic_id)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao buscar canal WhatsApp:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao buscar canal WhatsApp.",
        },
        { status: 500 },
      );
    }

    const channel = data as WhatsappChannelRow | null;

    if (!channel) {
      return NextResponse.json(
        {
          error: "channel_not_found",
          message: "Canal WhatsApp não encontrado ou inativo.",
        },
        { status: 404 },
      );
    }

    if (!channel.external_instance_id || !channel.token) {
      return NextResponse.json(
        {
          error: "channel_misconfigured",
          message:
            "Canal WhatsApp sem credenciais configuradas (instance/token).",
        },
        { status: 500 },
      );
    }

    const url = `${zapiBaseUrl}/${channel.external_instance_id}/send-text`;

    const providerResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channel.token}`,
      },
      body: JSON.stringify({
        phone: to,
        message: text,
      }),
    });

    const providerBody = await providerResponse.json().catch(() => null);

    if (!providerResponse.ok) {
      // eslint-disable-next-line no-console
      console.error("Erro ao enviar mensagem via Z-API:", providerBody);
      return NextResponse.json(
        {
          error: "provider_error",
          message: "Falha ao enviar mensagem via provedor WhatsApp.",
          provider_status: providerResponse.status,
        },
        { status: 502 },
      );
    }

    const externalMessageId =
      (providerBody &&
        (providerBody.messageId ||
          providerBody.message_id ||
          providerBody.id)) ||
      null;

    // Registro opcional em tabela messages (se existir)
    try {
      await supabase.from("messages").insert({
        clinic_id,
        conversation_id: body.conversation_id ?? null,
        patient_id: body.patient_id ?? null,
        direction: "outbound",
        channel: "whatsapp",
        external_message_id: externalMessageId,
        content_type: "text",
        content_text: text,
        content_raw: providerBody,
      });
    } catch (logError) {
      // eslint-disable-next-line no-console
      console.warn("Falha ao registrar mensagem em 'messages':", logError);
    }

    return NextResponse.json(
      {
        status: "sent",
        provider: "zapi",
        external_message_id: externalMessageId,
      },
      { status: 200 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/whatsapp/send:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao enviar a mensagem.",
      },
      { status: 500 },
    );
  }
}

