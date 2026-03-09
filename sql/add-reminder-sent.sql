ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent boolean DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS post_consultation_sent boolean DEFAULT false;
