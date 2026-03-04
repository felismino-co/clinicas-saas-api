# Resumo dos endpoints da API e uso no N8n

Base URL (exemplo): `https://seu-dominio.com/api`  
Headers recomendados para o N8n: `Authorization: Bearer <token_serviço>` e `Content-Type: application/json` quando houver body.

---

## 1. Lista de endpoints

| Método | Caminho | Uso |
|--------|---------|-----|
| GET | `/clinics/by-number` | Resolver clínica pelo número de WhatsApp |
| POST | `/ai/classify-intent` | Classificar intenção da mensagem (IA) |
| GET | `/patients/search` | Buscar paciente por telefone |
| POST | `/patients` | Criar paciente quando não existir |
| GET | `/schedule/availability` | Listar horários disponíveis |
| POST | `/appointments` | Criar agendamento |
| PATCH | `/appointments/:id` | Atualizar status do agendamento |
| POST | `/whatsapp/send` | Enviar mensagem WhatsApp (Z-API) |
| POST | `/conversations/handoff` | Marcar conversa para humano |

---

## 2. Detalhe de cada endpoint

### GET /clinics/by-number

- **Query:** `number` (obrigatório) — número do canal WhatsApp, ex: `+5511999999999`
- **Resposta 200:** `clinic_id`, `name`, `timezone`, `opening_hours`, `ai_profile`, `whatsapp.phone_number`, `whatsapp.channel_id`
- **404:** Nenhuma clínica para esse número

---

### POST /ai/classify-intent

- **Body:** `clinic_id`, `message_text`, `from`; opcional: `conversation`, `clinic_profile`, `ai_profile`
- **Resposta 200:** `intent`, `confidence`, `is_new_patient`, `needs_handoff`, `extracted_fields` (ex.: desired_date, desired_period, service_type)

---

### GET /patients/search

- **Query:** `clinic_id`, `phone` (obrigatórios)
- **Resposta 200:** `{ "patients": [ { "id", "clinic_id", "full_name", "phone", "email", "tags" } ] }` — lista vazia se não houver

---

### POST /patients

- **Body:** `clinic_id`, `phone` (obrigatórios); `full_name`, `email`, `birth_date`, `document`, `tags` (opcionais)
- **Resposta 201:** paciente criado (id, clinic_id, full_name, phone, etc.)
- **409:** Já existe paciente com esse telefone na clínica (retorna `patient_id`)

---

### GET /schedule/availability

- **Query:** `clinic_id`, `service_id`, `date` (YYYY-MM-DD)
- **Resposta 200:** `clinic_id`, `service_id`, `date`, `slots`: `[{ "starts_at", "ends_at" }]` (ISO com timezone)

---

### POST /appointments

- **Body:** `clinic_id`, `patient_id`, `starts_at`, `ends_at` (obrigatórios); `provider_id`, `service_id`, `source` (whatsapp | phone | manual | campaign), `notes` (opcionais)
- **Resposta 201:** agendamento criado (id, status: scheduled, etc.)
- **404:** Paciente não encontrado na clínica

---

### PATCH /appointments/:id

- **Body:** `{ "status": "confirmed" }` (ou `cancelled`, `no_show`, `completed`, `scheduled`)
- **Resposta 200:** agendamento atualizado
- **404:** Agendamento não encontrado

---

### POST /whatsapp/send

- **Body:** `clinic_id`, `to` (número do paciente), `channel_id` (id do canal em `whatsapp_channels`), `type`: `"text"`, `text`; opcional: `conversation_id`, `patient_id`
- **Resposta 200:** `status: "sent"`, `provider: "zapi"`, `external_message_id`
- **404:** Canal não encontrado ou inativo

---

### POST /conversations/handoff

- **Body:** `clinic_id`, `conversation_id`, `reason` (texto); opcional: `assigned_to_user_id`
- **Resposta 200:** `ok: true`, `conversation` (dados atualizados), `message`. Marca `needs_human: true` e registra motivo; recepção pode ser notificada via painel ou webhook.

---

## 3. Ordem de chamadas no N8n (fluxo principal – atendimento WhatsApp)

1. **Webhook** recebe mensagem do WhatsApp (Z-API) → normalizar payload (`clinic_number`, `from`, `message_text`).

2. **GET /clinics/by-number**  
   - Query: `number` = `clinic_number` do payload.  
   - Usar na resposta: `clinic_id`, `opening_hours`, `ai_profile`, `whatsapp.channel_id` (para envio depois).  
   - Se 404 → enviar mensagem “clínica não configurada” e encerrar.

3. **(Opcional)** Verificar horário de funcionamento com `opening_hours` e data/hora atual. Se fora do horário → **POST /whatsapp/send** com mensagem de “fora do horário” e encerrar.

4. **POST /ai/classify-intent**  
   - Body: `clinic_id`, `message_text`, `from`; opcional: `conversation` (id, last_intent), `clinic_profile`, `ai_profile` (da resposta do passo 2).  
   - Usar: `intent`, `needs_handoff`, `is_new_patient`, `extracted_fields`.

5. **Se needs_handoff ou intent = FALAR_HUMANO:**  
   - **POST /conversations/handoff** (body: `clinic_id`, `conversation_id`, `reason`).  
   - **POST /whatsapp/send**: “Vou te passar para um atendente, um momento.”  
   - Encerrar ramo.

6. **Se intent = AGENDAR:**  
   - **GET /patients/search** (query: `clinic_id`, `phone` = `from`).  
   - Se `patients` vazio → **POST /patients** (body: `clinic_id`, `phone`, `full_name` se tiver) e usar o `id` retornado como `patient_id`.  
   - **GET /schedule/availability** (query: `clinic_id`, `service_id` — ex.: do `extracted_fields.service_type` ou default), `date` (ex.: `extracted_fields.desired_date` ou amanhã).  
   - Montar mensagem com 2–3 opções de `slots` e **POST /whatsapp/send**.  
   - (Em fluxo com Wait) Quando o usuário responder com o horário escolhido → **POST /appointments** (body: `clinic_id`, `patient_id`, `starts_at`, `ends_at` do slot, `source: "whatsapp"`).  
   - **POST /whatsapp/send**: confirmação do agendamento.

7. **Se intent = CONFIRMAR:**  
   - (Identificar agendamento do paciente, ex.: próximo por data.)  
   - **PATCH /appointments/:id** (body: `{ "status": "confirmed" }`).  
   - **POST /whatsapp/send**: “Consulta confirmada.”

8. **Se intent = CANCELAR:**  
   - (Identificar agendamento.)  
   - **PATCH /appointments/:id** (body: `{ "status": "cancelled" }`).  
   - **POST /whatsapp/send**: “Cancelamento registrado.”

9. **Se intent = DUVIDA ou VENDAS:**  
   - (Opcional: **POST /ai/generate-reply** se existir.)  
   - Caso contrário, montar resposta padrão ou FAQ e **POST /whatsapp/send**.

Em todos os envios de resposta ao paciente use **POST /whatsapp/send** com `clinic_id`, `to` = `from`, `channel_id` (do passo 2), `type: "text"`, `text`.

---

## 4. Variáveis úteis no N8n

- `clinic_id` — saída de GET /clinics/by-number.  
- `channel_id` — `whatsapp.channel_id` da mesma resposta.  
- `patient_id` — saída de GET /patients/search (primeiro item) ou de POST /patients.  
- `conversation_id` — id da conversa atual (criado/obtido no seu fluxo).  
- Para **POST /whatsapp/send**: usar sempre `channel_id` e `clinic_id` do passo 2.
