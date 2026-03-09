-- Auditoria + colunas de criador em appointments
-- Execute no SQL Editor do Supabase

-- Tabela de auditoria
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  user_id uuid,
  user_name text,
  user_email text,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_clinic_id ON audit_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Quem criou o agendamento
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_user_id uuid;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS created_by_name text;

-- app_users: nome/email para listagem de equipe (staff)
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
