-- Agenda por médico: horários por dia da semana e bloqueios de data
-- 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb

ALTER TABLE providers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS crm text;
ALTER TABLE providers ADD COLUMN IF NOT EXISTS phone text;

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
