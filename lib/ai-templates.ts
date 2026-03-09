export type ClinicType = "odontologia" | "estetica" | "cirurgia" | "geral" | "nutricao";

const TEMPLATES: Record<ClinicType, string> = {
  odontologia: `Clínica odontológica. Procedimentos: limpeza, restauração, canal, extração, clareamento, implantes, ortodontia. 
Foque em: alívio de dor, estética dental, prevenção. Nunca faça diagnóstico odontológico; oriente a agendar avaliação.`,

  estetica: `Clínica de estética. Procedimentos: aplicações, preenchimentos, toxina, peelings, limpeza de pele, depilação a laser, etc.
Foque em: resultados, autoestima, cuidados pós-procedimento. Use linguagem acolhedora e evite promessas milagrosas.`,

  cirurgia: `Clínica cirúrgica. Foco em: pré e pós-operatório, cuidados, retorno, exames.
Oriente sobre preparo e recuperação. Em caso de dúvida sobre sintomas pós-cirurgia, recomende contato com a equipe ou retorno.`,

  geral: `Clínica médica geral. Consultas, exames, encaminhamentos.
Seja objetivo: agendamento, confirmação, dúvidas sobre horários e serviços. Nunca substitua orientação médica.`,

  nutricao: `Clínica de nutrição. Foco em: dieta, acompanhamento, resultados, reeducação alimentar.
Mencione que a consulta com nutricionista é essencial para um plano personalizado. Não prescreva dietas.`,
};

export function getContextTemplate(type: ClinicType): string {
  return TEMPLATES[type] ?? TEMPLATES.geral;
}
