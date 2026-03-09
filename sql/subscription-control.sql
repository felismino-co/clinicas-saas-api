-- Controle de acesso por assinatura (Kiwiify + trial)
-- Trial: 15 dias grátis; overdue: 3 dias tolerância

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan text DEFAULT 'trial';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz DEFAULT (now() + interval '15 days');
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial'
  CHECK (subscription_status IN ('trial', 'active', 'overdue', 'canceled', 'blocked'));
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS overdue_since timestamptz;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS kiwify_subscription_id text;
