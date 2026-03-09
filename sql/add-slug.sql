-- Adiciona coluna slug na tabela clinics para URLs públicas de agendamento
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS slug text UNIQUE;
UPDATE clinics SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]', '-', 'g')) WHERE slug IS NULL;
