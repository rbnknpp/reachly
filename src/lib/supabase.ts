import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY fehlen. .env aus .env.example anlegen.",
  );
}

// Einziger Backend-Zugriff des Dashboards. RLS regelt alle Zugriffsrechte,
// hier wird bewusst nur der anon-Key verwendet.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
