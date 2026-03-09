-- CRM + Integrações: script único para rodar no Supabase
-- Contatos e leads por clínica
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid,
  patient_id uuid REFERENCES patients(id) ON DELETE SET NULL,
  phone text NOT NULL,
  full_name text,
  first_contact_at timestamptz DEFAULT now(),
  last_contact_at timestamptz DEFAULT now(),
  is_first_time boolean DEFAULT true,
  status text DEFAULT 'lead'
    CHECK (status IN ('lead', 'interested', 'scheduled', 'patient', 'inactive')),
  source text DEFAULT 'whatsapp',
  tags text[] DEFAULT '{}',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contacts_clinic_id ON contacts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_clinic_phone ON contacts(clinic_id, phone);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_last_contact_at ON contacts(last_contact_at DESC);

-- Integrações de calendário por profissional (Google Calendar)
CREATE TABLE IF NOT EXISTS calendar_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES providers(id) ON DELETE CASCADE,
  clinic_id uuid,
  google_calendar_id text,
  google_refresh_token text,
  google_access_token text,
  token_expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_provider_id ON calendar_integrations(provider_id);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_clinic_id ON calendar_integrations(clinic_id);
