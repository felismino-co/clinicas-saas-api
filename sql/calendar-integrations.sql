-- Integrações de calendário por profissional (Google Calendar, etc.)
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
