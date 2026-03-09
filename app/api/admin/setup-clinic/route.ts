import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

function badRequest(message: string) {
  return NextResponse.json({ error: "bad_request", message }, { status: 400 });
}

type Body = {
  clinic: {
    name: string;
    phone?: string;
    address?: string;
    email?: string;
    owner_password: string;
    slug?: string;
  };
  whatsapp?: {
    whatsapp_number?: string;
    zapi_instance_id?: string;
    zapi_token?: string;
  };
  professionals?: Array<{ full_name: string; specialty?: string }>;
  services?: Array<{ name: string; duration_minutes?: number; price?: number }>;
  ai?: {
    assistant_name?: string;
    tone?: string;
    context?: string;
    automations?: { reminder_48h?: boolean; reminder_24h?: boolean; post_consultation?: boolean; reactivation?: boolean };
  };
  plan?: string;
};

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic: clinicPayload, whatsapp, professionals, services, ai, plan } = body;
  if (!clinicPayload?.name?.trim()) return badRequest("Nome da clínica é obrigatório.");
  if (!clinicPayload?.email?.trim()) return badRequest("Email do dono é obrigatório.");
  if (!clinicPayload?.owner_password?.trim()) return badRequest("Senha inicial do dono é obrigatória.");

  function errWithStep(step: number, message: string, status: number) {
    return NextResponse.json({ error: "step_error", message, step }, { status });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return badRequest(
      "SUPABASE_SERVICE_ROLE_KEY não está configurada. Adicione no .env.local para criar clínicas.",
    );
  }

  if (!supabaseAdmin) {
    return badRequest(
      "Serviço de administração Supabase não disponível. Verifique SUPABASE_SERVICE_ROLE_KEY no .env.local.",
    );
  }

  const baseSlug = clinicPayload.slug?.trim() || slugFromName(clinicPayload.name) || "clinica";
  const planValue = plan ?? "trial";
  const planExpiresAt = planValue === "trial" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;

  async function ensureUniqueSlug(desired: string): Promise<string> {
    const { data: existing } = await supabase.from("clinics").select("id").eq("slug", desired).maybeSingle();
    if (!existing) return desired;
    let suffix = 2;
    for (;;) {
      const candidate = `${desired}-${suffix}`;
      const { data: taken } = await supabase.from("clinics").select("id").eq("slug", candidate).maybeSingle();
      if (!taken) return candidate;
      suffix += 1;
    }
  }

  try {
    const slug = await ensureUniqueSlug(baseSlug);

    // Etapa 1 - criar clínica
    let clinicId: string;
    try {
      let completionScore = 20;
      if (clinicPayload.phone?.trim()) completionScore += 15;
      if (clinicPayload.address?.trim()) completionScore += 15;
      if (Array.isArray(professionals) && professionals.some((p) => p?.full_name?.trim())) completionScore += 20;
      if (Array.isArray(services) && services.some((s) => s?.name?.trim())) completionScore += 15;
      if (whatsapp?.whatsapp_number?.trim() || whatsapp?.zapi_instance_id?.trim() || whatsapp?.zapi_token?.trim()) completionScore += 15;

      const insertPayload: Record<string, unknown> = {
        name: clinicPayload.name.trim(),
        phone: clinicPayload.phone?.trim() ?? null,
        email: clinicPayload.email?.trim() ?? null,
        slug,
        plan: planValue,
        active: true,
        plan_expires_at: planExpiresAt,
        completion_score: completionScore,
      };
      // address só é incluído após rodar sql/add-address.sql (coluna opcional)
      const { data: clinicRow, error: clinicErr } = await supabase
        .from("clinics")
        .insert(insertPayload)
        .select("id")
        .single();

      if (clinicErr) {
        return errWithStep(1, clinicErr.message ?? "Falha ao criar clínica.", 500);
      }
      if (!clinicRow) {
        return errWithStep(1, "Falha ao criar clínica.", 500);
      }
      clinicId = (clinicRow as { id: string }).id;
    } catch (err) {
      return errWithStep(1, err instanceof Error ? err.message : "Falha ao criar clínica.", 500);
    }

    // Etapa 2 - criar usuário dono (Auth)
    let authUserId: string;
    type AuthDataResult = { user: { user_metadata?: { full_name?: unknown }; id: string } | null };
    let authData: AuthDataResult | null = null;
    try {
      const result = await supabaseAdmin.auth.admin.createUser({
        email: clinicPayload.email!.trim(),
        password: clinicPayload.owner_password.trim(),
        email_confirm: true,
        user_metadata: { full_name: clinicPayload.name.trim() },
      });
      authData = result.data;
      const authErr = result.error;

      if (authErr) {
        const isDuplicateEmail = authErr.message?.toLowerCase().includes("already") ?? false;
        if (isDuplicateEmail) {
          await supabase.from("clinics").delete().eq("id", clinicId);
          return badRequest("Email já cadastrado. Use outro email.");
        }
        return errWithStep(2, authErr.message ?? "Falha ao criar usuário dono.", 500);
      }
      if (!authData?.user) {
        await supabase.from("clinics").delete().eq("id", clinicId);
        return errWithStep(2, "Falha ao criar usuário dono.", 500);
      }
      authUserId = authData.user.id;
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
        console.error("[setup-clinic] Etapa 2 OK — user.id:", authUserId);
      }
    } catch (err) {
      await supabase.from("clinics").delete().eq("id", clinicId).then(() => {});
      return errWithStep(2, err instanceof Error ? err.message : "Falha ao criar usuário.", 500);
    }

    // Etapa 3 - app_users
    try {
      const ownerName = (authData?.user?.user_metadata?.full_name as string) ?? clinicPayload.name?.trim() ?? "";
      const ownerEmail = clinicPayload.email!.trim();
      const appUserInsert = {
        id: crypto.randomUUID(),
        user_id: authUserId,
        clinic_id: clinicId,
        role: "owner",
        full_name: ownerName,
        email: ownerEmail,
        active: true,
      } as Record<string, unknown>;
      const { error: appUserErr } = await supabase.from("app_users").insert(appUserInsert);

      if (appUserErr) {
        return errWithStep(3, appUserErr.message ?? "Falha ao vincular usuário (insert).", 500);
      }

      const { data: verifyRow, error: selectErr } = await supabase
        .from("app_users")
        .select("id, user_id, clinic_id, role")
        .eq("user_id", authUserId)
        .eq("clinic_id", clinicId)
        .maybeSingle();

      if (selectErr || !verifyRow) {
        return errWithStep(3, "Falha ao vincular usuário: registro não encontrado após insert.", 500);
      }
    } catch (err) {
      return errWithStep(3, err instanceof Error ? err.message : "Falha ao vincular usuário.", 500);
    }

    // Etapa 4 - profissionais (só se enviou dados)
    const profs = Array.isArray(professionals) ? professionals.filter((p) => p?.full_name?.trim()) : [];
    if (profs.length > 0) {
      try {
        for (const p of profs.slice(0, 5)) {
          await supabase.from("providers").insert({
            clinic_id: clinicId,
            full_name: p.full_name.trim(),
            specialty: p.specialty?.trim() ?? null,
          } as Record<string, unknown>);
        }
      } catch {
        // ignora falhas opcionais
      }
    }

    // Etapa 5 - serviços (só se enviou dados)
    const svcs = Array.isArray(services) ? services.filter((s) => s?.name?.trim()) : [];
    if (svcs.length > 0) {
      try {
        for (const s of svcs.slice(0, 5)) {
          await supabase.from("services").insert({
            clinic_id: clinicId,
            name: s.name.trim(),
            duration_minutes: s.duration_minutes ?? null,
            price: s.price ?? null,
          } as Record<string, unknown>);
        }
      } catch {
        // ignora falhas opcionais
      }
    }

    // Etapa 6 - perfil IA (só se enviou dados de IA)
    if (ai && (ai.assistant_name ?? ai.context ?? ai.tone)) {
      try {
        const automations = ai.automations ?? {};
        await supabase.from("clinic_ai_profiles").insert({
          clinic_id: clinicId,
          assistant_name: ai.assistant_name?.trim() ?? "Ana",
          tone: ai.tone ?? "humanizado",
          context: ai.context?.trim() ?? "",
          automations: {
            reminder_48h: automations.reminder_48h !== false,
            reminder_24h: automations.reminder_24h !== false,
            post_2h: automations.post_consultation !== false,
            post_7d: true,
            reactivation_90: automations.reactivation !== false,
          },
        } as Record<string, unknown>);
      } catch {
        // ignora falhas opcionais
      }
    }

    // Etapa 7 - WhatsApp (só se enviou dados)
    const hasWhatsapp = whatsapp?.whatsapp_number?.trim() || whatsapp?.zapi_instance_id?.trim() || whatsapp?.zapi_token?.trim();
    if (hasWhatsapp) {
      try {
        await supabase.from("clinic_whatsapp_config").insert({
          clinic_id: clinicId,
          whatsapp_number: whatsapp?.whatsapp_number?.trim() ?? null,
          zapi_instance_id: whatsapp?.zapi_instance_id?.trim() ?? null,
          zapi_token: whatsapp?.zapi_token?.trim() ?? null,
          is_active: true,
        } as Record<string, unknown>);
      } catch {
        // ignora se tabela não existir
      }
    }

    const origin = request.nextUrl.origin;
    return NextResponse.json(
      {
        clinic_id: clinicId,
        clinic_slug: slug,
        owner_email: clinicPayload.email!.trim(),
        booking_url: `${origin}/booking/${slug}`,
        dashboard_url: `${origin}/owner`,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: "unexpected_error", message: err instanceof Error ? err.message : "Erro ao configurar clínica.", step: 0 },
      { status: 500 },
    );
  }
}
