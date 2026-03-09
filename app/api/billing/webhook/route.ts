import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

async function verifyStripeSignature(
  request: NextRequest,
  body: string,
): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false;
  const sig = request.headers.get("stripe-signature");
  if (!sig) return false;
  try {
    const crypto = await import("crypto");
    const [timestamp, v1] = sig.split(",").reduce(
      (acc, part) => {
        const [k, v] = part.split("=");
        if (k === "t") acc[0] = v;
        if (k === "v1") acc[1] = v;
        return acc;
      },
      ["" as string, "" as string],
    );
    const payload = `${timestamp}.${body}`;
    const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
    return v1 === expected;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!body) return badRequest("Body vazio.");

  const valid = await verifyStripeSignature(request, body);
  if (!valid && WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "invalid_signature", message: "Assinatura Stripe inválida." },
      { status: 401 },
    );
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(body) as { type?: string; data?: { object?: Record<string, unknown> } };
  } catch {
    return badRequest("JSON inválido.");
  }

  const type = event.type;
  const obj = event.data?.object as Record<string, unknown> | undefined;
  const metadata = obj?.metadata as { clinic_id?: string; plan?: string } | undefined;

  try {
    if (type === "checkout.session.completed" && obj) {
      const clinicId = metadata?.clinic_id;
      const subscriptionId = obj.subscription as string | undefined;
      const customerId = obj.customer as string | undefined;
      if (clinicId) {
        await supabase
          .from("clinics")
          .update({
            stripe_customer_id: customerId ?? null,
            stripe_subscription_id: subscriptionId ?? null,
            plan: metadata?.plan ?? "pro",
            active: true,
            plan_expires_at: null,
          } as Record<string, unknown>)
          .eq("id", clinicId);
      }
    } else if (type === "customer.subscription.deleted" && obj) {
      const subId = obj.id as string;
      const { data: clinics } = await supabase
        .from("clinics")
        .select("id")
        .eq("stripe_subscription_id", subId);
      if (clinics?.length) {
        await supabase
          .from("clinics")
          .update({
            active: false,
            stripe_subscription_id: null,
            plan: "trial",
          } as Record<string, unknown>)
          .eq("id", (clinics[0] as { id: string }).id);
      }
    } else if (type === "invoice.payment_failed" && obj) {
      // Notificar admin: poderia enviar email ou log
      // eslint-disable-next-line no-console
      console.warn("Stripe invoice.payment_failed", obj.id);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Billing webhook error:", err);
    return NextResponse.json(
      { error: "processing_error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
