import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/**
 * Cliente Supabase com service role (apenas servidor).
 * Usado para: criar usuários (staff), resetar senha, etc.
 * Defina SUPABASE_SERVICE_ROLE_KEY no .env.local para usar.
 */
export const supabaseAdmin =
  serviceRoleKey && supabaseUrl
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;
