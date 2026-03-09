-- Colunas opcionais em clinics (endereço, email, billing, slug, settings, completion_score)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan text DEFAULT 'trial';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS completion_score integer DEFAULT 20;
