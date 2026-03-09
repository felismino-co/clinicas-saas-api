import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

type PostBody = {
  clinic_name?: string;
  contact_name: string;
  whatsapp: string;
  service: string;
  clinic_id?: string;
};

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic_name, contact_name, whatsapp, service, clinic_id } = body;
  if (!contact_name?.trim() || !whatsapp?.trim() || !service?.trim()) {
    return badRequest("contact_name, whatsapp e service são obrigatórios.");
  }

  try {
    const { data, error } = await supabase
      .from("marketing_leads")
      .insert({
        clinic_id: clinic_id || null,
        clinic_name: clinic_name?.trim() || null,
        contact_name: contact_name.trim(),
        whatsapp: whatsapp.trim(),
        service: service.trim(),
        status: "new",
      })
      .select("id")
      .single();

    if (error) {
      console.error("marketing/contact insert error:", error);
      return NextResponse.json(
        { error: "database_error", message: "Erro ao salvar lead." },
        { status: 500 },
      );
    }

    const webhookUrl = process.env.N8N_MARKETING_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clinic_name: clinic_name?.trim() || "",
            contact_name: contact_name.trim(),
            whatsapp: whatsapp.trim(),
            service: service.trim(),
            lead_id: (data as { id?: string })?.id,
          }),
        });
      } catch (err) {
        console.warn("N8n webhook failed:", err);
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("marketing/contact error:", err);
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao processar solicitação." },
      { status: 500 },
    );
  }
}
