-- Regras de comissão por profissional (percentual ou valor fixo, opcional por serviço)

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
