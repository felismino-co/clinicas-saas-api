# CONTEXT.md — Sistema SaaS de Atendimento para Clínicas

## Visão Geral
SaaS multi-tenant de atendimento via WhatsApp para clínicas médicas/odontológicas.
A IA atende os pacientes automaticamente via WhatsApp, agenda consultas, confirma, cancela e transfere para humano quando necessário.

## Stack Tecnológica
- **Frontend/API:** Next.js 16 + React + TypeScript + Tailwind (pasta `app-web/`)
- **Banco de dados:** Supabase (Postgres) — projeto `zirycbhtkqnjrxziewww`
- **Automações:** N8n (cloud — app.n8n.io)
- **WhatsApp:** Z-API (a configurar)
- **IA:** Groq (llama-3.1-70b-versatile)
- **Pagamentos:** Stripe (a configurar)
- **Deploy API:** Vercel — https://clinicas-saas-api.vercel.app
- **Repositório:** https://github.com/felismino-co/clinicas-saas-api
- **IDE:** Cursor com AIOS (12 agentes em `.cursor/rules/agents/`)

---

## Banco de Dados (Supabase)
16 tabelas criadas e funcionando:
- `clinics` — clínicas cadastradas (multi-tenant)
- `app_users` — usuários do sistema
- `clinic_members` — vínculo usuário ↔ clínica + papel (admin_global, clinic_owner, receptionist)
- `ai_templates` — templates de IA por tipo de clínica
- `whatsapp_channels` — canais WhatsApp por clínica
- `patients` — pacientes por clínica
- `providers` — profissionais (médicos/dentistas)
- `services` — serviços/procedimentos
- `appointments` — agendamentos
- `conversations` — conversas WhatsApp
- `messages` — mensagens individuais
- `campaigns` — campanhas de reativação/promo
- `campaign_messages` — mensagens de campanhas
- `plans` — planos do SaaS
- `subscriptions` — assinaturas Stripe
- `metrics_daily_clinic` — métricas agregadas diárias

### Dados de teste no banco:
- Clínica: `Clínica Teste` — ID: `5b6be922-273f-436e-9eb0-515767ec7817`
- Paciente: `João Silva Teste` — ID: `ee6eebe2-5025-427e-a827-6e05762b6eaf`
- Serviço: `Consulta Padrão` — ID: `e988b748-f346-4189-a1e2-692eefe612fb`
- Canal WhatsApp: `5511999999999` (teste)

---

## API Endpoints (todos em produção na Vercel)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/clinics/by-number` | Identifica clínica pelo número WhatsApp |
| POST | `/api/ai/classify-intent` | Classifica intenção da mensagem (Groq) |
| GET | `/api/patients/search` | Busca paciente por telefone |
| POST | `/api/patients` | Cria paciente novo |
| GET | `/api/schedule/availability` | Lista horários disponíveis |
| POST | `/api/appointments` | Cria agendamento |
| PATCH | `/api/appointments/[id]` | Atualiza status do agendamento |
| POST | `/api/whatsapp/send` | Envia mensagem via Z-API |
| POST | `/api/conversations/handoff` | Transfere conversa para humano |

---

## Variáveis de Ambiente (.env.local)
```
GROQ_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=https://zirycbhtkqnjrxziewww.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=https://zirycbhtkqnjrxziewww.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=... (service_role key — acesso total sem RLS)
```

### Observação importante:
O `lib/supabase.ts` usa a service_role key hardcoded temporariamente para resolver problema de RLS. Antes de ir para produção real, mover para variável de ambiente.

---

## N8n — Fluxo Principal
Fluxo importado no N8n cloud com 27 nós cobrindo:
1. Webhook Z-API recebe mensagem
2. Normaliza payload
3. GET /clinics/by-number — identifica clínica
4. Verifica horário de funcionamento
5. POST /ai/classify-intent — classifica intenção
6. Switch por intent: AGENDAR, CONFIRMAR, CANCELAR, DUVIDA, FALAR_HUMANO
7. Para AGENDAR: busca/cria paciente → disponibilidade → cria agendamento
8. POST /whatsapp/send — responde paciente

### Variáveis N8n configuradas:
- `API_BASE_URL` = `https://clinicas-saas-api.vercel.app`
- `DEFAULT_SERVICE_ID` = `e988b748-f346-4189-a1e2-692eefe612fb`

### Pendente:
- Conectar Z-API (instância WhatsApp não configurada ainda)
- Configurar webhook da Z-API apontando para o N8n

---

## Interface (Painéis)

### ✅ Painel da Secretária (parcialmente pronto)
- Localização: `app/secretary/AgendaPage.tsx` + `AgendaTable.tsx`
- Funcionalidades prontas:
  - Agenda do dia com dados reais do Supabase
  - Filtros por profissional e status
  - Botões: Confirmar, No-show, Cancelar (funcionando via PATCH /api/appointments/[id])

### ❌ A construir (backlog completo em `.cursor/rules/` ou gerado pelo @sm):

**Painel Secretária (continuação):**
- ST-006: Criar agendamento manual
- ST-007: Remarcar agendamento
- ST-008: Buscar paciente
- ST-009: Criar paciente básico
- ST-010: Popup detalhes paciente
- ST-011 a ST-014: Caixa de entrada / handoff
- ST-015 a ST-016: Atalhos operacionais

**Painel Dono da Clínica:**
- Dashboard com KPIs
- Agenda multi-profissional
- Gerenciar profissionais e serviços
- Configurar horários de funcionamento
- Configurar IA (templates + overrides)
- Gerenciar equipe
- Campanhas de reativação

**Painel Admin Global (dono do SaaS):**
- Dashboard multi-clínica
- Lista e onboarding de clínicas
- Gerenciar planos
- Gerenciar templates de IA
- Relatórios globais

---

## Arquitetura de Papéis
- **Admin Global** — dono do SaaS, acesso total a todas as clínicas
- **Clinic Owner** — dono da clínica, acesso à própria clínica
- **Receptionist** — secretária, acesso operacional (agenda, pacientes, inbox)

---

## Próximos Passos Prioritários
1. Conectar Z-API e testar fluxo WhatsApp ponta a ponta
2. Continuar Painel Secretária (ST-006 a ST-010)
3. Construir Painel Dono da Clínica
4. Implementar autenticação (Supabase Auth)
5. Construir Painel Admin Global
6. Configurar RLS no Supabase
7. Configurar Stripe para cobrança

---

## Como Continuar o Desenvolvimento
1. Abrir o projeto no Cursor: `D:\12 agentes que fazem sistemas\meu-projeto`
2. Entrar na pasta `app-web` no terminal
3. Rodar `npm run dev`
4. Usar os agentes AIOS: `@dev`, `@architect`, `@sm`, `@pm`, etc.
5. Sempre commitar e dar push após mudanças:
   ```
   git add .
   git commit -m "descrição"
   git push
   ```
