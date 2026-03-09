-- Planos do SaaS: Básico, Pro, Enterprise (editáveis pelo admin)
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price_month numeric NOT NULL,
  description text,
  max_providers integer,
  features jsonb DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO plans (name, price_month, description, max_providers) VALUES
  ('Básico', 497, 'Ideal para clínicas pequenas', 2),
  ('Pro', 997, 'Para clínicas em crescimento', 5),
  ('Enterprise', 1397, 'Sem limites', 999)
ON CONFLICT (name) DO NOTHING;
