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
