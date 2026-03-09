ALTER TABLE clinics ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan text DEFAULT 'trial';
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
