-- Consolidado: agenda por médico, comissões, aniversariantes, providers (email, crm, phone)
-- Execute no SQL Editor do Supabase

-- Providers: campos adicionais
ALTER TABLE providers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS crm text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS phone text;

-- Agenda por médico
CREATE TABLE IF NOT EXISTS provider_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_provider_id ON provider_schedules(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_clinic_id ON provider_schedules(clinic_id);

CREATE TABLE IF NOT EXISTS provider_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  blocked_date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_provider_blocks_provider_id ON provider_blocks(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_blocks_blocked_date ON provider_blocks(blocked_date);

-- Comissões
CREATE TABLE IF NOT EXISTS commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('percentage', 'fixed')),
  value numeric NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_rules_clinic_id ON commission_rules(clinic_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_provider_id ON commission_rules(provider_id);

-- Aniversariantes: data de nascimento em pacientes
ALTER TABLE patients ADD COLUMN IF NOT EXISTS birth_date date;
