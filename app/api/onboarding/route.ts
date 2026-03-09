import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

type ClinicPayload = {
  name: string;
  phone?: string;
  address?: string;
  email?: string;
};

type ProviderPayload = {
  full_name: string;
  specialty?: string;
};

type ServicePayload = {
  name: string;
  duration_minutes?: number;
  price?: number;
};

type OnboardingBody = {
  clinic: ClinicPayload;
  provider: ProviderPayload;
  service: ServicePayload;
};

export async function POST(request: NextRequest) {
  let body: OnboardingBody;
  try {
    body = (await request.json()) as OnboardingBody;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const { clinic, provider, service } = body;
  if (!clinic?.name?.trim()) {
    return badRequest("Clínica: nome é obrigatório.");
  }
  if (!provider?.full_name?.trim()) {
    return badRequest("Profissional: nome é obrigatório.");
  }
  if (!service?.name?.trim()) {
    return badRequest("Serviço: nome é obrigatório.");
  }

  try {
    const { data: clinicRow, error: clinicErr } = await supabase
      .from("clinics")
      .insert({
        name: clinic.name.trim(),
        phone: clinic.phone?.trim() ?? null,
        address: clinic.address?.trim() ?? null,
        email: clinic.email?.trim() ?? null,
      } as Record<string, unknown>)
      .select("id")
      .single();

    if (clinicErr || !clinicRow) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao criar clínica." },
        { status: 500 },
      );
    }

    const clinicId = (clinicRow as { id: string }).id;

    const { data: providerRow, error: providerErr } = await supabase
      .from("providers")
      .insert({
        clinic_id: clinicId,
        full_name: provider.full_name.trim(),
        specialty: provider.specialty?.trim() ?? null,
      } as Record<string, unknown>)
      .select("id")
      .single();

    if (providerErr || !providerRow) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao criar profissional." },
        { status: 500 },
      );
    }

    const providerId = (providerRow as { id: string }).id;

    const { data: serviceRow, error: serviceErr } = await supabase
      .from("services")
      .insert({
        clinic_id: clinicId,
        name: service.name.trim(),
        duration_minutes: service.duration_minutes ?? null,
        price: service.price ?? null,
      } as Record<string, unknown>)
      .select("id")
      .single();

    if (serviceErr || !serviceRow) {
      return NextResponse.json(
        { error: "database_error", message: "Falha ao criar serviço." },
        { status: 500 },
      );
    }

    const serviceId = (serviceRow as { id: string }).id;

    return NextResponse.json(
      { clinic_id: clinicId, provider_id: providerId, service_id: serviceId },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "unexpected_error", message: "Erro ao concluir onboarding." },
      { status: 500 },
    );
  }
}
