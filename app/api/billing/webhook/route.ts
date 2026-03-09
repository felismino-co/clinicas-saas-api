import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const STRIPE_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const KIWIFY_SECRET = process.env.KIWIFY_WEBHOOK_SECRET;

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

async function verifyStripeSignature(request: NextRequest, body: string): Promise<boolean> {
  if (!STRIPE_SECRET) return false;
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
    const expected = crypto.createHmac("sha256", STRIPE_SECRET).update(payload).digest("hex");
    return v1 === expected;
  } catch {
    return false;
  }
}

function getCustomerEmail(payload: Record<string, unknown>): string | null {
  const customer = payload.customer as { email?: string } | undefined;
  const buyer = payload.buyer as { email?: string } | undefined;
  const email = customer?.email ?? buyer?.email ?? (payload.customer_email as string);
  return typeof email === "string" && email.trim() ? email.trim() : null;
}

function getPlanFromProductName(name: string | undefined): string {
  if (!name || typeof name !== "string") return "pro";
  const n = name.toLowerCase();
  if (n.includes("básico") || n.includes("basico")) return "basico";
  if (n.includes("pro")) return "pro";
  if (n.includes("enterprise")) return "enterprise";
  return "pro";
}

async function findClinicIdByEmail(email: string): Promise<string | null> {
  const { data: byClinic } = await supabase.from("clinics").select("id").eq("email", email).limit(1).maybeSingle();
  if (byClinic && (byClinic as { id?: string }).id) return (byClinic as { id: string }).id;
  const { data: byAppUser } = await supabase.from("app_users").select("clinic_id").eq("email", email).limit(1).maybeSingle();
  if (byAppUser && (byAppUser as { clinic_id?: string }).clinic_id) return (byAppUser as { clinic_id: string }).clinic_id;
  return null;
}

async function logAudit(clinicId: string | null, action: string, details: Record<string, unknown>) {
  await supabase.from("audit_log").insert({
    clinic_id: clinicId,
    action,
    details,
  } as Record<string, unknown>);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  if (!body) return badRequest("Body vazio.");

  const kiwifyToken = request.headers.get("x-kiwify-token");
  if (kiwifyToken !== undefined && kiwifyToken !== null) {
    if (KIWIFY_SECRET && kiwifyToken !== KIWIFY_SECRET) {
      return NextResponse.json({ error: "unauthorized", message: "Token Kiwify inválido." }, { status: 401 });
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return badRequest("JSON inválido.");
    }
    const event = (payload.event ?? payload.event_name ?? payload.type) as string | undefined;
    const email = getCustomerEmail(payload);
    if (!email) {
      return NextResponse.json({ error: "bad_request", message: "Email do cliente não encontrado." }, { status: 400 });
    }
    const clinicId = await findClinicIdByEmail(email);
    if (!clinicId) {
      return NextResponse.json({ received: true, message: "Clínica não encontrada para o email." }, { status: 200 });
    }
    try {
      if (event === "order.approved") {
        const product = payload.product as { name?: string } | undefined;
        const subscription = payload.subscription as { id?: string } | undefined;
        const plan = getPlanFromProductName(product?.name);
        const now = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("clinics")
          .update({
            active: true,
            subscription_status: "active",
            plan,
            plan_expires_at: expiresAt,
            last_payment_at: now,
            overdue_since: null,
            kiwify_subscription_id: subscription?.id ?? null,
          } as Record<string, unknown>)
          .eq("id", clinicId);
        await logAudit(clinicId, "kiwify_order_approved", { event, email, plan });
      } else if (event === "order.refunded" || event === "order.canceled") {
        await supabase
          .from("clinics")
          .update({ active: false, subscription_status: "canceled" } as Record<string, unknown>)
          .eq("id", clinicId);
        await logAudit(clinicId, "kiwify_order_refunded_or_canceled", { event, email });
      } else if (event === "subscription.overdue") {
        const { data: clinic } = await supabase.from("clinics").select("overdue_since").eq("id", clinicId).single();
        const overdueSince = (clinic as { overdue_since?: string } | null)?.overdue_since;
        await supabase
          .from("clinics")
          .update({
            subscription_status: "overdue",
            ...(overdueSince ? {} : { overdue_since: new Date().toISOString() }),
          } as Record<string, unknown>)
          .eq("id", clinicId);
        await logAudit(clinicId, "kiwify_subscription_overdue", { event, email });
      } else if (event === "subscription.canceled") {
        await supabase
          .from("clinics")
          .update({ active: false, subscription_status: "canceled" } as Record<string, unknown>)
          .eq("id", clinicId);
        await logAudit(clinicId, "kiwify_subscription_canceled", { event, email });
      }
    } catch (err) {
      console.error("Billing webhook Kiwify error:", err);
      return NextResponse.json({ error: "processing_error" }, { status: 500 });
    }
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const valid = await verifyStripeSignature(request, body);
  if (!valid && STRIPE_SECRET) {
    return NextResponse.json({ error: "invalid_signature", message: "Assinatura Stripe inválida." }, { status: 401 });
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
            subscription_status: "active",
            plan_expires_at: null,
            last_payment_at: new Date().toISOString(),
            overdue_since: null,
          } as Record<string, unknown>)
          .eq("id", clinicId);
      }
    } else if (type === "customer.subscription.deleted" && obj) {
      const subId = obj.id as string;
      const { data: clinics } = await supabase.from("clinics").select("id").eq("stripe_subscription_id", subId);
      if (clinics?.length) {
        await supabase
          .from("clinics")
          .update({
            active: false,
            stripe_subscription_id: null,
            plan: "trial",
            subscription_status: "canceled",
          } as Record<string, unknown>)
          .eq("id", (clinics[0] as { id: string }).id);
      }
    } else if (type === "invoice.payment_failed" && obj) {
      console.warn("Stripe invoice.payment_failed", obj.id);
    }
  } catch (err) {
    console.error("Billing webhook error:", err);
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
