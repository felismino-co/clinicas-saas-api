import { createClient } from "@supabase/supabase-js";

// Preferir variáveis de servidor em produção (Vercel, etc.)
const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error("Variáveis SUPABASE_URL / SUPABASE_ANON_KEY não estão definidas.");
  throw new Error(
    "Configuração do Supabase ausente. Defina SUPABASE_URL e SUPABASE_ANON_KEY.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

