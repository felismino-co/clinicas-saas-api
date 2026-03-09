import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clinicId = url.searchParams.get("clinic_id");
  if (!clinicId) return badRequest("clinic_id é obrigatório.");

  try {
    const { data, error } = await supabase
      .from("clinics")
      .select("id, name, plan, plan_expires_at, active, stripe_customer_id, stripe_subscription_id")
      .eq("id", clinicId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json(
        { error: "not_found", message: "Clínica não encontrada." },
        { status: 404 },
      );
    }

    const row = data as Record<string, unknown>;
    const status = {
      plan: row.plan ?? "trial",
      plan_expires_at: row.plan_expires_at ?? null,
      active: row.active !== false,
      stripe_customer_id: row.stripe_customer_id ?? null,
      stripe_subscription_id: row.stripe_subscription_id ?? null,
    };
    return NextResponse.json({ clinic: row, subscription: status }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao buscar assinatura." },
      { status: 500 },
    );
  }
}

type PostBody = { clinic_id: string; plan?: string };

export async function POST(request: NextRequest) {
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic_id, plan } = body;
  if (!clinic_id?.trim()) return badRequest("clinic_id é obrigatório.");

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "config", message: "Stripe não configurado." },
      { status: 503 },
    );
  }

  try {
    const { data: clinic } = await supabase
      .from("clinics")
      .select("id, name, stripe_customer_id")
      .eq("id", clinic_id)
      .single();

    if (!clinic) {
      return NextResponse.json(
        { error: "not_found", message: "Clínica não encontrada." },
        { status: 404 },
      );
    }

    const planId = plan ?? "pro";
    const priceId = process.env.STRIPE_PRICE_ID ?? "price_placeholder";
    const origin = request.nextUrl.origin;
    const customerId = (clinic as { stripe_customer_id?: string }).stripe_customer_id;

    const sessionPayload: Record<string, unknown> = {
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/owner?checkout=success`,
      cancel_url: `${origin}/owner?checkout=cancelled`,
      metadata: { clinic_id, plan: planId },
    };
    if (customerId) sessionPayload.customer = customerId;

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionPayload),
    });

    const session = (await res.json()) as { url?: string; id?: string; error?: { message?: string } };
    if (session.error) {
      return NextResponse.json(
        { error: "stripe_error", message: session.error.message ?? "Erro ao criar sessão." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { url: session.url, session_id: session.id },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao criar checkout." },
      { status: 500 },
    );
  }
}
