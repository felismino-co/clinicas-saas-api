-- Perfis de IA por clínica (nome do assistente, tom, contexto/prompt base)
CREATE TABLE IF NOT EXISTS clinic_ai_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  assistant_name text NOT NULL DEFAULT 'Ana',
  tone text NOT NULL DEFAULT 'humanizado' CHECK (tone IN ('humanizado', 'formal', 'descontraído', 'persuasivo')),
  context text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(clinic_id)
);

ALTER TABLE clinic_ai_profiles ADD COLUMN IF NOT EXISTS automations jsonb DEFAULT '{}';

COMMENT ON TABLE clinic_ai_profiles IS 'Configuração da IA de atendimento por clínica';

-- Perfil padrão para clínica de teste
INSERT INTO clinic_ai_profiles (clinic_id, assistant_name, tone, context)
VALUES (
  '5b6be922-273f-436e-9eb0-515767ec7817'::uuid,
  'Ana',
  'humanizado',
  'Você é Ana, assistente virtual da clínica. Ajude o paciente com agendamentos, confirmações e dúvidas. Seja cordial e objetiva. Se o paciente pedir para falar com um humano, indique que um atendente irá assumir.'
)
ON CONFLICT (clinic_id) DO NOTHING;
