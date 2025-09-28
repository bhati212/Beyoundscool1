// If you don't use TypeScript, rename to .js and remove types.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
  "";

const key =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  "";

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;

