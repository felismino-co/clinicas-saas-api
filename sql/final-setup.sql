-- =============================================================================
-- final-setup.sql — CREATEs e ALTERs necessários para o SaaS de clínicas
-- Execute no SQL Editor do Supabase na ordem apresentada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- clinic_ai_profiles
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- clinic_whatsapp_config
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinic_whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  whatsapp_number text,
  zapi_instance_id text,
  zapi_token text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id)
);
COMMENT ON TABLE clinic_whatsapp_config IS 'Configuração WhatsApp/Z-API por clínica';

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  segment text NOT NULL,
  message_template text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  total_sent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE campaigns IS 'Campanhas de mensagens em massa por segmento de pacientes';

-- -----------------------------------------------------------------------------
-- appointments
-- -----------------------------------------------------------------------------
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS post_consultation_sent boolean DEFAULT false;

-- -----------------------------------------------------------------------------
-- patients
-- -----------------------------------------------------------------------------
ALTER TABLE patients ADD COLUMN IF NOT EXISTS blocked boolean DEFAULT false;

-- -----------------------------------------------------------------------------
-- clinics
-- -----------------------------------------------------------------------------
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan text DEFAULT 'trial';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
-- Opcional: CREATE UNIQUE INDEX IF NOT EXISTS clinics_slug_key ON clinics(slug) WHERE slug IS NOT NULL;
