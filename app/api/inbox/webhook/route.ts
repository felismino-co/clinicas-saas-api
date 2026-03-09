import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const DEFAULT_CLINIC_ID = "5b6be922-273f-436e-9eb0-515767ec7817";

type WebhookBody = {
  phone?: string;
  message?: string;
  timestamp?: string;
  clinic_id?: string;
};

async function sendViaN8n(phone: string, message: string, clinicId: string): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, clinic_id: clinicId }),
    });
  } catch {
    // ignore
  }
}

async function sendViaN8nWithDelays(
  phone: string,
  messages: string[],
  clinicId: string,
): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url || messages.length === 0) return;
  const delays = messages.map((_, i) => (i === 0 ? 0 : 2000 * i));
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, messages, delays, clinic_id: clinicId }),
    });
  } catch {
    // ignore
  }
}

export async function POST(request: NextRequest) {
  let body: WebhookBody;
  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Payload inválido." },
      { status: 400 },
    );
  }

  const { phone, message, clinic_id } = body;
  const clinicId = clinic_id?.trim() || DEFAULT_CLINIC_ID;
  if (!phone || !message) {
    return NextResponse.json(
      { error: "bad_request", message: "phone e message são obrigatórios." },
      { status: 400 },
    );
  }

  try {
    let conversationId: string | null = null;
    let needsHuman = true;

    const { data: existing } = await supabase
      .from("conversations")
      .select("id, needs_human")
      .eq("clinic_id", clinicId)
      .eq("whatsapp_from", phone)
      .limit(1)
      .maybeSingle();

    if (existing) {
      conversationId = (existing as { id: string }).id;
      needsHuman = Boolean((existing as { needs_human?: boolean }).needs_human);
    } else {
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("clinic_id", clinicId)
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();

      const now = new Date().toISOString();
      const { data: newConv, error: createErr } = await supabase
        .from("conversations")
        .insert({
          clinic_id: clinicId,
          patient_id: patient?.id ?? null,
          whatsapp_from: phone,
          last_activity_at: now,
          last_message: message,
          last_message_at: now,
          needs_human: false,
        } as Record<string, unknown>)
        .select("id")
        .single();

      if (createErr || !newConv) {
        return NextResponse.json(
          { error: "database_error", message: "Falha ao criar conversa." },
          { status: 500 },
        );
      }
      conversationId = (newConv as { id: string }).id;
      needsHuman = false;
    }

    const { error: msgErr } = await supabase.from("messages").insert({
      clinic_id: clinicId,
      conversation_id: conversationId,
      direction: "inbound",
      channel: "whatsapp",
      content_type: "text",
      content_text: message,
    } as Record<string, unknown>);

    if (msgErr) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao salvar mensagem." },
        { status: 500 },
      );
    }

    const now = new Date().toISOString();
    await supabase
      .from("conversations")
      .update({
        last_activity_at: now,
        last_message: message,
        last_message_at: now,
      } as Record<string, unknown>)
      .eq("id", conversationId);

    let contactIsFirstTime = true;
    let contactName: string | null = null;
    try {
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id, is_first_time, full_name")
        .eq("clinic_id", clinicId)
        .eq("phone", phone)
        .limit(1)
        .maybeSingle();

      if (existingContact && (existingContact as { id: string }).id) {
        const c = existingContact as { id: string; is_first_time?: boolean; full_name?: string | null };
        contactIsFirstTime = c.is_first_time === true;
        contactName = c.full_name?.trim() ?? null;
        await supabase
          .from("contacts")
          .update({
            last_contact_at: now,
            is_first_time: false,
          } as Record<string, unknown>)
          .eq("id", c.id);
      } else {
        await supabase.from("contacts").insert({
          clinic_id: clinicId,
          phone,
          last_contact_at: now,
          first_contact_at: now,
          is_first_time: true,
          status: "lead",
          source: "whatsapp",
        } as Record<string, unknown>);
      }
    } catch {
      // não falha o webhook se a tabela contacts não existir ainda
    }

    if (!needsHuman && conversationId) {
      const { data: messagesData } = await supabase
        .from("messages")
        .select("direction, content_text")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      const list = (messagesData ?? []) as Array<{ direction: string; content_text: string | null }>;
      const last20 = list.slice(-20);
      const history = last20.map((m) => ({
        role: m.direction === "inbound" ? "user" as const : "assistant" as const,
        content: m.content_text ?? "",
      }));

      const origin = request.nextUrl.origin;
      try {
        const aiRes = await fetch(`${origin}/api/ai/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: conversationId,
            clinic_id: clinicId,
            message: message.trim(),
            history,
            is_first_time: contactIsFirstTime,
            patient_name: contactName ?? undefined,
          }),
        });
        const aiData = (await aiRes.json()) as {
          response?: string;
          responses?: string[];
          should_handoff?: boolean;
        };
        const responses = Array.isArray(aiData.responses) && aiData.responses.length > 0
          ? aiData.responses.map((r) => String(r).trim()).filter(Boolean)
          : aiData.response?.trim()
            ? [aiData.response.trim()]
            : [];
        const responseText = responses.join("\n");
        const shouldHandoff = Boolean(aiData.should_handoff);

        if (responses.length > 0) {
          await supabase.from("messages").insert({
            clinic_id: clinicId,
            conversation_id: conversationId,
            direction: "outbound",
            channel: "whatsapp",
            content_type: "text",
            content_text: responseText,
          } as Record<string, unknown>);

          const now2 = new Date().toISOString();
          await supabase
            .from("conversations")
            .update({
              last_activity_at: now2,
              last_message: responseText,
              last_message_at: now2,
              needs_human: shouldHandoff,
            } as Record<string, unknown>)
            .eq("id", conversationId);

          if (responses.length > 1) {
            await sendViaN8nWithDelays(phone, responses, clinicId);
          } else {
            await sendViaN8n(phone, responseText, clinicId);
          }
        } else if (shouldHandoff) {
          await supabase
            .from("conversations")
            .update({ needs_human: true } as Record<string, unknown>)
            .eq("id", conversationId);
        }
      } catch {
        // on AI error we don't update needs_human
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao processar webhook." },
      { status: 500 },
    );
  }
}
