import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { createCookieStoreForRouteHandler } from "../../../lib/supabase-server";
import { getCurrentUser } from "../../../lib/get-current-user";
import { logAction, AUDIT_ACTIONS } from "../../../lib/audit";

type CreateAppointmentRequest = {
  clinic_id: string;
  patient_id: string;
  provider_id?: string | null;
  service_id?: string | null;
  starts_at: string;
  ends_at: string;
  source?: string;
  notes?: string | null;
};

const VALID_SOURCES = ["whatsapp", "phone", "manual", "campaign"];

function badRequest(message: string) {
  return NextResponse.json(
    { error: "bad_request", message },
    { status: 400 },
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAppointment(a: any) {
  return {
    ...a,
    patients: Array.isArray(a.patients) ? (a.patients[0] ?? null) : a.patients,
    providers: Array.isArray(a.providers) ? (a.providers[0] ?? null) : a.providers,
    services: Array.isArray(a.services) ? (a.services[0] ?? null) : a.services,
  };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  let clinicId = url.searchParams.get("clinic_id");
  const headerClinicId = request.headers.get("x-clinic-id");
  if (headerClinicId && clinicId && headerClinicId !== clinicId) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado a esta clínica." }, { status: 403 });
  }
  if (!clinicId) clinicId = headerClinicId;
  const patientId = url.searchParams.get("patient_id");
  const dateParam = url.searchParams.get("date");

  if (!clinicId) {
    return badRequest("Parâmetro 'clinic_id' é obrigatório.");
  }

  try {
    if (patientId) {
      const { data, error } = await supabase
        .from("appointments")
        .select(
          `
          id, clinic_id, patient_id, provider_id, service_id,
          starts_at, ends_at, status, notes, created_by_user_id, created_by_name,
          patients (full_name, phone),
          providers (full_name),
          services (name)
        `,
        )
        .eq("clinic_id", clinicId)
        .eq("patient_id", patientId)
        .order("starts_at", { ascending: false });

      if (error) {
        // eslint-disable-next-line no-console
        console.error("Erro ao buscar agendamentos do paciente:", error);
        return NextResponse.json(
          {
            error: "database_error",
            message: "Falha ao buscar agendamentos.",
          },
          { status: 500 },
        );
      }

      const normalized = (data ?? []).map((a: any) => normalizeAppointment(a));
      return NextResponse.json({ appointments: normalized }, { status: 200 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const date = dateParam || today;
    const startOfDay = `${date}T00:00:00.000Z`;
    const endOfDay = `${date}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from("appointments")
      .select(
        `
        id, clinic_id, patient_id, provider_id, service_id,
        starts_at, ends_at, status, notes, created_by_user_id, created_by_name,
        patients (full_name, phone),
        providers (full_name),
        services (name)
      `,
      )
      .eq("clinic_id", clinicId)
      .gte("starts_at", startOfDay)
      .lte("starts_at", endOfDay)
      .order("starts_at", { ascending: true });

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao buscar agenda:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao buscar agendamentos.",
        },
        { status: 500 },
      );
    }

    const normalized = (data ?? []).map((a: any) => normalizeAppointment(a));

    const [providersRes, servicesRes] = await Promise.all([
      supabase
        .from("providers")
        .select("id, full_name")
        .eq("clinic_id", clinicId)
        .order("full_name", { ascending: true }),
      supabase
        .from("services")
        .select("id, name")
        .eq("clinic_id", clinicId)
        .order("name", { ascending: true }),
    ]);

    if (providersRes.error || servicesRes.error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao buscar profissionais/serviços:", {
        providersError: providersRes.error,
        servicesError: servicesRes.error,
      });
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao buscar metadados da agenda.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        appointments: normalized,
        date,
        providers: providersRes.data ?? [],
        services: servicesRes.data ?? [],
      },
      { status: 200 },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/appointments GET:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao buscar a agenda.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const cookieStore = createCookieStoreForRouteHandler(request);
  const currentUser = await getCurrentUser(cookieStore);

  let body: CreateAppointmentRequest;

  try {
    body = (await request.json()) as CreateAppointmentRequest;
  } catch {
    return badRequest("Payload JSON inválido.");
  }

  const headerClinicId = request.headers.get("x-clinic-id");
  if (headerClinicId && body.clinic_id && headerClinicId !== body.clinic_id) {
    return NextResponse.json({ error: "forbidden", message: "Acesso negado a esta clínica." }, { status: 403 });
  }

  const {
    clinic_id,
    patient_id,
    provider_id,
    service_id,
    starts_at,
    ends_at,
    source = "whatsapp",
    notes,
  } = body;

  if (!clinic_id || !patient_id || !starts_at || !ends_at) {
    return badRequest(
      "Campos obrigatórios: 'clinic_id', 'patient_id', 'starts_at', 'ends_at'.",
    );
  }

  if (!VALID_SOURCES.includes(source)) {
    return badRequest(
      `'source' deve ser um de: ${VALID_SOURCES.join(", ")}.`,
    );
  }

  const starts = new Date(starts_at);
  const ends = new Date(ends_at);
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) {
    return badRequest("'starts_at' e 'ends_at' devem ser datas válidas (ISO).");
  }
  if (ends <= starts) {
    return badRequest("'ends_at' deve ser posterior a 'starts_at'.");
  }

  try {
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name")
      .eq("id", patient_id)
      .eq("clinic_id", clinic_id)
      .maybeSingle();

    if (!patient) {
      return NextResponse.json(
        {
          error: "patient_not_found",
          message: "Paciente não encontrado nesta clínica.",
        },
        { status: 404 },
      );
    }

    const patientName = (patient as { full_name?: string }).full_name ?? null;
    const insertPayload: Record<string, unknown> = {
      clinic_id,
      patient_id,
      provider_id: provider_id ?? null,
      service_id: service_id ?? null,
      starts_at: starts_at,
      ends_at: ends_at,
      status: "scheduled",
      source,
      notes: notes ?? null,
    };
    if (currentUser) {
      insertPayload.created_by_user_id = currentUser.user_id;
      insertPayload.created_by_name = currentUser.user_name;
    }

    const { data: appointment, error } = await supabase
      .from("appointments")
      .insert(insertPayload)
      .select("id, clinic_id, patient_id, provider_id, service_id, starts_at, ends_at, status")
      .single();

    if (error) {
      // eslint-disable-next-line no-console
      console.error("Erro ao criar agendamento:", error);
      return NextResponse.json(
        {
          error: "database_error",
          message: "Falha ao criar agendamento.",
        },
        { status: 500 },
      );
    }

    if (currentUser) {
      await logAction({
        clinic_id: currentUser.clinic_id,
        user_id: currentUser.user_id,
        user_name: currentUser.user_name,
        user_email: currentUser.user_email,
        action: AUDIT_ACTIONS.APPOINTMENT_CREATED,
        entity_type: "appointment",
        entity_id: (appointment as { id: string }).id,
        details: {
          appointment_id: (appointment as { id: string }).id,
          patient_name: patientName,
          starts_at,
          provider_id: provider_id ?? null,
          service_id: service_id ?? null,
        },
      });
    }

    const res = NextResponse.json(appointment, { status: 201 });
    cookieStore.appendCookiesToResponse(res);
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erro inesperado em /api/appointments POST:", err);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message: "Ocorreu um erro inesperado ao criar o agendamento.",
      },
      { status: 500 },
    );
  }
}
