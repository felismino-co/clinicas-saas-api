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
  const conversationId = url.searchParams.get("conversation_id");

  if (!conversationId) {
    return badRequest("Parâmetro 'conversation_id' é obrigatório.");
  }

  try {
    const { data, error } = await supabase
      .from("messages")
      .select("id, conversation_id, direction, content_text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ messages: [] }, { status: 200 });
    }

    const list = (data ?? []).map((m: Record<string, unknown>) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      direction: m.direction,
      content: m.content_text ?? "",
      created_at: m.created_at,
    }));

    return NextResponse.json({ messages: list }, { status: 200 });
  } catch {
    return NextResponse.json({ messages: [] }, { status: 200 });
  }
}

type PostBody = {
  conversation_id: string;
  content: string;
  direction?: "outbound";
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { conversation_id, content } = body;
  if (!conversation_id || !content?.trim()) {
    return badRequest("'conversation_id' e 'content' são obrigatórios.");
  }

  try {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, clinic_id, patient_id, whatsapp_from")
      .eq("id", conversation_id)
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: "not_found", message: "Conversa não encontrada." },
        { status: 404 },
      );
    }

    const { data: msg, error: insertError } = await supabase
      .from("messages")
      .insert({
        clinic_id: conv.clinic_id,
        conversation_id,
        patient_id: conv.patient_id,
        direction: "outbound",
        channel: "whatsapp",
        content_type: "text",
        content_text: content.trim(),
      })
      .select("id, conversation_id, direction, content_text, created_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao enviar mensagem." },
        { status: 500 },
      );
    }

    const now = new Date().toISOString();
    await supabase
      .from("conversations")
      .update({
        last_activity_at: now,
        last_message: content.trim(),
        last_message_at: now,
      } as Record<string, unknown>)
      .eq("id", conversation_id);

    const origin = request.nextUrl.origin;
    if (conv.whatsapp_from) {
      const { data: channel } = await supabase
        .from("whatsapp_channels")
        .select("id")
        .eq("clinic_id", conv.clinic_id)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (channel) {
        try {
          await fetch(`${origin}/api/whatsapp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clinic_id: conv.clinic_id,
              to: conv.whatsapp_from,
              channel_id: channel.id,
              type: "text",
              text: content.trim(),
              conversation_id,
              patient_id: conv.patient_id,
            }),
          });
        } catch {
          // ignore
        }
      }
    }

    return NextResponse.json(
      {
        message: {
          id: msg.id,
          conversation_id: msg.conversation_id,
          direction: "outbound",
          content: msg.content_text,
          created_at: msg.created_at,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao enviar mensagem." },
      { status: 500 },
    );
  }
}
