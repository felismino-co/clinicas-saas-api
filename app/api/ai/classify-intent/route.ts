// app/api/ai/classify-intent/route.ts
import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

if (!process.env.GROQ_API_KEY) {
  // Aviso em build/runtime – não exposto ao cliente
  // eslint-disable-next-line no-console
  console.warn("GROQ_API_KEY não está definido.");
}

type ClassifyIntentRequest = {
  clinic_id: string;
  message_text: string;
  from: string;
  conversation?: {
    id?: string;
    last_intent?: string;
  };
  clinic_profile?: Record<string, unknown>;
  ai_profile?: {
    tone?: string;
    use_emojis?: boolean;
    sales_focus?: "low" | "medium" | "high" | string;
  };
};

type ClassifyIntentResponse = {
  intent:
    | "AGENDAR"
    | "CONFIRMAR"
    | "CANCELAR"
    | "DUVIDA"
    | "VENDAS"
    | "FALAR_HUMANO";
  confidence: number;
  is_new_patient: boolean;
  needs_handoff: boolean;
  extracted_fields: {
    desired_date?: string | null;
    desired_period?: string | null;
    service_type?: string | null;
    doctor_preference?: string | null;
    [key: string]: unknown;
  };
};

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        error: "server_config_error",
        message: "GROQ_API_KEY não configurada no servidor.",
      },
      { status: 500 },
    );
  }

  let body: ClassifyIntentRequest;

  try {
    body = (await req.json()) as ClassifyIntentRequest;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  // Validação mínima de campos obrigatórios
  if (!body.message_text || typeof body.message_text !== "string") {
    return badRequest("Campo 'message_text' é obrigatório e deve ser string.");
  }

  if (!body.clinic_id || typeof body.clinic_id !== "string") {
    return badRequest("Campo 'clinic_id' é obrigatório e deve ser string.");
  }

  if (!body.from || typeof body.from !== "string") {
    return badRequest("Campo 'from' é obrigatório e deve ser string.");
  }

  try {
    const systemPrompt = `
Você é um assistente de triagem de mensagens para uma clínica médica/odontológica.

Sua função é:
1) Identificar a INTENÇÃO principal da mensagem do paciente.
2) Estimar se é provavelmente um paciente novo ou existente.
3) Dizer se é melhor passar para um humano (handoff).
4) Extrair dados úteis para agendamento quando fizer sentido.

REGRAS IMPORTANTES:
- Responda SEMPRE em JSON VÁLIDO, sem texto extra, sem comentários.
- NUNCA inclua explicações fora do JSON.
- Campos obrigatórios:
  - intent: uma das [ "AGENDAR", "CONFIRMAR", "CANCELAR", "DUVIDA", "VENDAS", "FALAR_HUMANO" ]
  - confidence: número entre 0 e 1
  - is_new_patient: true ou false (se não tiver certeza, escolha a melhor hipótese)
  - needs_handoff: true se for melhor passar para humano (reclamação, emoção forte, dúvida clínica complexa, etc.)
  - extracted_fields: objeto com o que conseguir extrair (pode ser vazio)

Diretrizes para intent:
- AGENDAR: pessoa querendo marcar consulta, exame, procedimento, avaliação.
- CONFIRMAR: confirmando horário já marcado.
- CANCELAR: cancelando ou querendo remarcar.
- DUVIDA: perguntas sobre funcionamento, preço, procedimentos, etc. sem foco claro em compra.
- VENDAS: interesse em tratamento/procedimento com intenção de compra (pode sobrepor com DUVIDA, escolha VENDAS se o foco parecer mais comercial).
- FALAR_HUMANO: quando explicitamente pedir para falar com atendente ou quando a mensagem indicar algo sensível (reclamação grave, ameaça, assunto jurídico, situação emocional delicada).

Diretrizes para needs_handoff:
- true se:
  - reclamação forte
  - menção a processo, advogado, PROCON, erro médico
  - conteúdo emocionalmente carregado (raiva, choro, luto)
  - dúvidas clínicas complexas que exigem médico
- false para pedidos simples de agendamento, confirmação, dúvidas comuns.

Quando extraír dados em extracted_fields, use chaves:
- desired_date (string ISO ou descrição livre, ex: "2026-03-10" ou "amanhã")
- desired_period ("manha" | "tarde" | "noite" | null)
- service_type (ex: "limpeza", "avaliação odontológica", "cirurgia plástica")
- doctor_preference (nome ou descrição, se houver)
`;

    const userContext = {
      clinic_id: body.clinic_id,
      from: body.from,
      message_text: body.message_text,
      conversation: body.conversation ?? null,
      clinic_profile: body.clinic_profile ?? null,
      ai_profile: body.ai_profile ?? null,
    };

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt.trim(),
        },
        {
          role: "user",
          content: JSON.stringify(userContext),
        },
      ],
      temperature: 0.2,
      max_tokens: 512,
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: Partial<ClassifyIntentResponse>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fallback robusto caso o modelo quebre o formato
      parsed = {};
    }

    const intent =
      parsed.intent &&
      [
        "AGENDAR",
        "CONFIRMAR",
        "CANCELAR",
        "DUVIDA",
        "VENDAS",
        "FALAR_HUMANO",
      ].includes(parsed.intent as string)
        ? (parsed.intent as ClassifyIntentResponse["intent"])
        : "DUVIDA";

    const confidence =
      typeof parsed.confidence === "number" &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
        ? parsed.confidence
        : 0.7;

    const is_new_patient =
      typeof parsed.is_new_patient === "boolean"
        ? parsed.is_new_patient
        : true;

    const needs_handoff =
      typeof parsed.needs_handoff === "boolean"
        ? parsed.needs_handoff
        : false;

    const extracted_fields =
      parsed.extracted_fields && typeof parsed.extracted_fields === "object"
        ? parsed.extracted_fields
        : {};

    const response: ClassifyIntentResponse = {
      intent,
      confidence,
      is_new_patient,
      needs_handoff,
      extracted_fields,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Erro em /ai/classify-intent:", error);
    return NextResponse.json(
      {
        error: "ai_error",
        message: "Falha ao classificar intenção com a IA.",
      },
      { status: 500 },
    );
  }
}