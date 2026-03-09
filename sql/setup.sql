-- =============================================================================
-- Setup SQL — Tabelas para o SaaS de clínicas (Supabase/PostgreSQL)
-- Execute este arquivo no SQL Editor do Supabase para criar as tabelas
-- que ainda não existem. Ajuste se sua instância já tiver parte do schema.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- conversations: conversas da caixa de entrada WhatsApp (uma por paciente/canal)
-- Liga paciente (opcional), clínica e histórico de última mensagem.
-- Se sua tabela já existir com "whatsapp_from", use esse nome ou adicione
-- uma coluna "phone" como alias.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'resolved')),
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_clinic_id ON conversations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phone_clinic ON conversations(phone, clinic_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at DESC);

COMMENT ON TABLE conversations IS 'Conversas da caixa de entrada WhatsApp por clínica';
COMMENT ON COLUMN conversations.phone IS 'Número de telefone/WhatsApp do contato';
COMMENT ON COLUMN conversations.last_message IS 'Texto da última mensagem (preview)';
COMMENT ON COLUMN conversations.unread_count IS 'Quantidade de mensagens não lidas';

-- -----------------------------------------------------------------------------
-- messages: mensagens individuais de cada conversa (inbound = recebida, outbound = enviada)
-- content pode ser o texto da mensagem; se sua tabela existir com content_text,
-- renomeie ou adicione uma view.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at ASC);

COMMENT ON TABLE messages IS 'Mensagens de cada conversa (WhatsApp, etc.)';
COMMENT ON COLUMN messages.direction IS 'inbound = recebida do paciente, outbound = enviada pela clínica';

-- -----------------------------------------------------------------------------
-- app_users: vínculo de usuários do sistema (auth) com clínica e role.
-- user_id = auth.users.id (UUID do Supabase Auth). Use clinic_members se já
-- tiver essa tabela para o mesmo propósito.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'receptionist' CHECK (role IN ('admin_global', 'clinic_owner', 'receptionist')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_user_id ON app_users(user_id);
CREATE INDEX IF NOT EXISTS idx_app_users_clinic_id ON app_users(clinic_id);

COMMENT ON TABLE app_users IS 'Usuários da aplicação: user_id (Auth), clinic_id e role';
COMMENT ON COLUMN app_users.role IS 'admin_global, clinic_owner ou receptionist';

-- -----------------------------------------------------------------------------
-- Colunas opcionais em conversations (se a tabela já existir com outros nomes):
-- - whatsapp_from → pode ser usado como phone; ou adicione: ALTER TABLE conversations ADD COLUMN IF NOT EXISTS phone TEXT;
-- - last_activity_at → pode ser usado como last_message_at; ou adicione last_message, last_message_at, unread_count.
-- Colunas opcionais em messages (se a tabela já existir):
-- - content_text → use como content ou: ALTER TABLE messages ADD COLUMN IF NOT EXISTS content TEXT;
-- - clinic_id, channel, content_type → úteis para multi-canal; não obrigatórios para o mínimo.
-- =============================================================================
