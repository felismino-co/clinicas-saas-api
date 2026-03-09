import { NextRequest, NextResponse } from "next/server";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

const MOCK_NOTIFICATIONS = [
  {
    id: "n1",
    type: "new_appointment",
    title: "Novo agendamento",
    message: "Maria Silva agendou para amanhã às 14h",
    created_at: new Date().toISOString(),
    read: false,
  },
  {
    id: "n2",
    type: "whatsapp",
    title: "Mensagem WhatsApp",
    message: "Nova mensagem de João Santos",
    created_at: new Date(Date.now() - 3600000).toISOString(),
    read: false,
  },
  {
    id: "n3",
    type: "confirmed",
    title: "Paciente confirmou",
    message: "Ana Costa confirmou o agendamento de 05/03",
    created_at: new Date(Date.now() - 7200000).toISOString(),
    read: false,
  },
];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  if (!clinicId) return badRequest("Parâmetro clinic_id é obrigatório.");

  const list = MOCK_NOTIFICATIONS.map((n) => ({
    ...n,
    read: n.read,
  }));
  const unreadCount = list.filter((n) => !n.read).length;

  return NextResponse.json(
    { notifications: list, unread_count: unreadCount },
    { status: 200 },
  );
}

export async function PATCH(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("Parâmetro id é obrigatório.");

  const found = MOCK_NOTIFICATIONS.some((n) => n.id === id);
  if (!found) {
    return NextResponse.json(
      { error: "not_found", message: "Notificação não encontrada." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    { success: true, id },
    { status: 200 },
  );
}
