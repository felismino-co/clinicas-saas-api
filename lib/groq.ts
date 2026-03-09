const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama3-8b-8192";
const MAX_TOKENS = 500;
const TEMPERATURE = 0.7;

export const PROMPT_BASE = `Você é {assistant_name}, assistente virtual de atendimento da {clinic_name}.

PERSONALIDADE E TOM:
- Seja extremamente humano, caloroso e empático
- Use linguagem natural, nunca robótica
- Chame o paciente pelo primeiro nome sempre que souber
- Use emojis com moderação (1-2 por mensagem máximo)
- Faça pausas naturais (respostas curtas e diretas)
- Nunca responda tudo de uma vez - divida em 2-3 mensagens curtas

REGRAS DE OURO:
- NUNCA faça diagnósticos ou prescreva tratamentos
- Se pergunta for clínica complexa: "Vou chamar um especialista para te ajudar com isso 😊"
- SEMPRE confirme dados importantes (nome, data, horário)
- Se o paciente estiver com dor ou emergência: prioridade máxima, ofereça encaixe

FLUXO DE AGENDAMENTO:
1. Cumprimente e pergunte o nome se não souber
2. Entenda o que o paciente precisa
3. Ofereça horários disponíveis (máximo 3 opções)
4. Confirme: nome completo, serviço, data, horário
5. Encerre com confirmação e lembre que enviará lembrete

TÉCNICAS DE VENDAS (use naturalmente):
- Prova social: "Temos muitos pacientes satisfeitos com esse procedimento"
- Urgência real: "Temos apenas 2 horários disponíveis essa semana"
- Benefício: foque no resultado, não no procedimento
- Objeção de preço: "Temos formas de pagamento facilitadas, posso verificar para você?"

CONTEXTO DA CLÍNICA:
{clinic_context}

HISTÓRICO DA CONVERSA:
{conversation_history}`;

export type ClinicContextData = {
  clinic: {
    name: string;
    address?: string;
    phone?: string;
    working_hours?: { start?: string; end?: string };
    working_days?: string;
  };
  providers: Array<{
    name: string;
    specialty?: string;
    schedule?: Array<{ day: string; start: string; end: string }>;
  }>;
  services: Array<{
    name: string;
    duration?: number;
    price?: number;
  }>;
  ai_profile?: {
    assistant_name?: string;
    tone?: string;
    context?: string;
    automations?: unknown;
  };
};

export function buildClinicContext(clinicData: ClinicContextData): string {
  const { clinic, providers, services } = clinicData;
  const start = clinic.working_hours?.start ?? "08:00";
  const end = clinic.working_hours?.end ?? "18:00";
  const days = clinic.working_days ?? "Seg a Sex";

  let text = `INFORMAÇÕES DA CLÍNICA:
Nome: ${clinic.name}
Endereço: ${clinic.address ?? "—"}
Telefone: ${clinic.phone ?? "—"}
Horário de funcionamento: ${days} das ${start} às ${end}

`;

  if (providers.length > 0) {
    text += "PROFISSIONAIS:\n";
    for (const p of providers) {
      const sched = (p.schedule ?? [])
        .map((s) => `${s.day} ${s.start}-${s.end}`)
        .join(", ");
      text += `- Dr(a). ${p.name} — ${p.specialty ?? "Atendimento"}\n  Atende: ${sched || "—"}\n`;
    }
    text += "\n";
  }

  if (services.length > 0) {
    text += "SERVIÇOS OFERECIDOS:\n";
    for (const s of services) {
      text += `- ${s.name}: ${s.duration ?? 0} min — R$ ${Number(s.price ?? 0).toFixed(2)}\n`;
    }
    text += "\n";
  }

  text += `REGRA IMPORTANTE: Só fale de procedimentos listados acima.
Se perguntarem sobre procedimento não listado, responda:
"Não realizamos esse procedimento. Posso ajudar com: [liste os serviços acima]."
`;

  return text;
}

export function buildSystemPrompt(params: {
  assistant_name: string;
  clinic_name: string;
  clinic_context: string;
  conversation_history: string;
}): string {
  return PROMPT_BASE.replace(/\{assistant_name\}/g, params.assistant_name)
    .replace(/\{clinic_name\}/g, params.clinic_name)
    .replace(/\{clinic_context\}/g, params.clinic_context)
    .replace(/\{conversation_history\}/g, params.conversation_history);
}

export type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function callGroq(
  messages: GroqMessage[],
  systemPrompt?: string,
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY não configurada.");
  }

  const allMessages: GroqMessage[] = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: allMessages,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  return content;
}
