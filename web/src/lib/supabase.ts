import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var __supabaseAdmin: SupabaseClient | undefined;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured on the server environment.`);
  }

  return value;
}

export function getSupabaseAdmin() {
  if (!globalThis.__supabaseAdmin) {
    const supabaseUrl = readEnv("SUPABASE_URL");
    const supabaseServiceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

    globalThis.__supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return globalThis.__supabaseAdmin;
}

export function isSupabaseEnvError(error: unknown) {
  return error instanceof Error
    && (error.message.includes("SUPABASE_URL is not configured")
      || error.message.includes("SUPABASE_SERVICE_ROLE_KEY is not configured"));
}

export function getErrorCode(error: unknown) {
  return (error as PostgrestError | undefined)?.code;
}
