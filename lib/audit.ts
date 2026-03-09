import { supabase } from "./supabase";

export const AUDIT_ACTIONS = {
  APPOINTMENT_CREATED: "APPOINTMENT_CREATED",
  APPOINTMENT_CONFIRMED: "APPOINTMENT_CONFIRMED",
  APPOINTMENT_CANCELLED: "APPOINTMENT_CANCELLED",
  APPOINTMENT_RESCHEDULED: "APPOINTMENT_RESCHEDULED",
  APPOINTMENT_NO_SHOW: "APPOINTMENT_NO_SHOW",
  PATIENT_CREATED: "PATIENT_CREATED",
  PATIENT_UPDATED: "PATIENT_UPDATED",
  PATIENT_BLOCKED: "PATIENT_BLOCKED",
  MESSAGE_SENT: "MESSAGE_SENT",
  AI_PAUSED: "AI_PAUSED",
  AI_ACTIVATED: "AI_ACTIVATED",
} as const;

export type AuditDetails = Record<string, unknown>;

export async function logAction(params: {
  clinic_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  details?: AuditDetails | null;
}): Promise<void> {
  try {
    await supabase.from("audit_log").insert({
      clinic_id: params.clinic_id ?? null,
      user_id: params.user_id ?? null,
      user_name: params.user_name ?? null,
      user_email: params.user_email ?? null,
      action: params.action,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      details: params.details ?? null,
    });
  } catch {
    // Silencioso: não quebrar o fluxo principal
  }
}
