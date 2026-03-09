import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import { callGroq, type GroqMessage, buildSystemPrompt as buildBasePrompt, buildClinicContext, type ClinicContextData } from "../../../../lib/groq";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

const INTENTS = ["AGENDAR", "CONFIRMAR", "CANCELAR", "DUVIDA", "FALAR_HUMANO"] as const;
type Intent = (typeof INTENTS)[number];

const INTENT_INSTRUCTION = `

Ao final da sua resposta, em uma linha sozinha, responda apenas com uma das intenções: AGENDAR, CONFIRMAR, CANCELAR, DUVIDA, FALAR_HUMANO.
Formato da última linha (obrigatório): INTENCAO: <uma das palavras acima>`;

function splitResponse(text: string, maxChunk = 200): string[] {
  const t = text.trim();
  if (!t) return [];
  if (t.length <= maxChunk) return [t];
  const parts: string[] = [];
  let rest = t;
  while (rest.length > 0) {
    if (rest.length <= maxChunk) {
      parts.push(rest);
      break;
    }
    const chunk = rest.slice(0, maxChunk);
    const lastBreak = Math.max(chunk.lastIndexOf("."), chunk.lastIndexOf("!"), chunk.lastIndexOf("?"), chunk.lastIndexOf("\n"), Math.floor(maxChunk * 0.8));
    const cut = lastBreak > 0 ? lastBreak + 1 : maxChunk;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return parts.filter(Boolean);
}

export async function POST(request: NextRequest) {
  let body: {
    conversation_id?: string;
    clinic_id?: string;
    message?: string;
    history?: Array<{ role: "user" | "assistant"; content: string }>;
    is_first_time?: boolean;
    patient_name?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { conversation_id, clinic_id, message, history, is_first_time, patient_name } = body;
  if (!clinic_id || !message?.trim()) {
    return badRequest("clinic_id e message são obrigatórios.");
  }

  try {
    const { data: profile, error: profileErr } = await supabase
      .from("clinic_ai_profiles")
      .select("assistant_name, tone, context")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: "no_profile", message: "Perfil de IA não configurado para esta clínica." },
        { status: 404 },
      );
    }

    const { data: clinicRow } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinic_id)
      .maybeSingle();
    const clinicName = (clinicRow as { name?: string } | null)?.name ?? "Nossa clínica";
    const assistantName = (profile as { assistant_name?: string }).assistant_name ?? "Ana";
    const baseContext = (profile as { context?: string | null }).context ?? "Clínica de saúde. Ajude com agendamentos e dúvidas.";

    let clinicContextText = baseContext;
    try {
      const origin = request.nextUrl.origin;
      const ctxRes = await fetch(`${origin}/api/ai/clinic-context?clinic_id=${encodeURIComponent(clinic_id)}`);
      if (ctxRes.ok) {
        const ctxData = (await ctxRes.json()) as {
          clinic?: ClinicContextData["clinic"];
          providers?: ClinicContextData["providers"];
          services?: ClinicContextData["services"];
          ai_profile?: ClinicContextData["ai_profile"];
        };
        const fullContext: ClinicContextData = {
          clinic: ctxData.clinic ?? { name: clinicName },
          providers: ctxData.providers ?? [],
          services: ctxData.services ?? [],
          ai_profile: ctxData.ai_profile,
        };
        clinicContextText = buildClinicContext(fullContext) + "\n\n" + baseContext;
      }
    } catch {
      // mantém baseContext se falhar o fetch
    }

    let extraInstructions = "";
    if (is_first_time === true) {
      extraInstructions += "\n\nÉ a PRIMEIRA VEZ que este contato fala com a clínica. Dê uma saudação especial de boas-vindas e pergunte o nome dele(a) se ainda não souber.";
    }
    if (patient_name?.trim()) {
      extraInstructions += `\n\nO nome do paciente/contato é: ${patient_name.trim()}. Use esse nome ao se dirigir a ele(a).`;
    }

    const historyList = Array.isArray(history) ? history.slice(-20) : [];
    const conversationHistory = historyList
      .map((h) => `${h.role === "user" ? "Paciente" : "Assistente"}: ${h.content}`)
      .join("\n") || "(Nenhuma mensagem anterior)";

    const systemPrompt =
      buildBasePrompt({
        assistant_name: assistantName,
        clinic_name: clinicName,
        clinic_context: clinicContextText + extraInstructions,
        conversation_history: conversationHistory,
      }) + INTENT_INSTRUCTION;

    const messages: GroqMessage[] = [
      ...historyList.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: message.trim() },
    ];

    const rawResponse = await callGroq(messages, systemPrompt);

    const lines = rawResponse.split(/\n/).filter(Boolean);
    let responseText = rawResponse;
    let intent: Intent = "DUVIDA";

    const lastLine = lines[lines.length - 1]?.trim() ?? "";
    const intentMatch = lastLine.match(/INTENCAO:\s*(\w+)/i);
    if (intentMatch) {
      const word = intentMatch[1].toUpperCase();
      if (INTENTS.includes(word as Intent)) {
        intent = word as Intent;
        responseText = lines.slice(0, -1).join("\n").trim() || rawResponse.replace(lastLine, "").trim();
      }
    }

    const singleText = responseText || "Em que mais posso ajudar?";
    const responses = splitResponse(singleText, 200);
    if (responses.length === 0) responses.push(singleText);

    if (conversation_id) {
      const userMsg = message.trim();
      const looksLikeName = /^[A-Za-zÀ-ú\s]{2,50}$/.test(userMsg) && userMsg.split(/\s+/).length <= 4;
      if (looksLikeName) {
        const { data: conv } = await supabase
          .from("conversations")
          .select("patient_id")
          .eq("id", conversation_id)
          .single();
        const patientId = (conv as { patient_id?: string } | null)?.patient_id;
        if (patientId) {
          await supabase
            .from("patients")
            .update({ full_name: userMsg.trim() } as Record<string, unknown>)
            .eq("id", patientId)
            .eq("clinic_id", clinic_id);
        }
      }
    }

    const should_handoff = intent === "FALAR_HUMANO";

    return NextResponse.json(
      { responses, response: responses[0], intent, should_handoff },
      { status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao processar resposta da IA.";
    return NextResponse.json(
      { error: "ai_error", message },
      { status: 500 },
    );
  }
}
