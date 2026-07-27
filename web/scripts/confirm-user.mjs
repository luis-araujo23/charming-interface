/**
 * Confirms a user without needing the email inbox.
 * Usage: node scripts/confirm-user.mjs email@example.com
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Uso: node scripts/confirm-user.mjs correo@ejemplo.com");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
const env = {};
for (const raw of envText.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  const key = line.slice(0, i).trim();
  let value = line.slice(i + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  env[key] = value;
}

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: list, error: listError } = await sb.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listError) {
  console.error(listError.message);
  process.exit(1);
}

const authUser = (list.users || []).find((u) => (u.email || "").toLowerCase() === email);
if (!authUser) {
  console.error("No hay usuario Auth con ese correo. Regístrate primero en Kitty.");
  process.exit(1);
}

const { error: confirmError } = await sb.auth.admin.updateUserById(authUser.id, {
  email_confirm: true,
});
if (confirmError) {
  console.error("No se pudo confirmar Auth:", confirmError.message);
  process.exit(1);
}

const { error: publicError } = await sb
  .from("users")
  .update({ email_confirmed: true })
  .eq("email", email);

if (publicError) {
  console.error("Auth confirmado, pero falló public.users:", publicError.message);
  process.exit(1);
}

const appUrl = (env.APP_URL || "https://tu-app.vercel.app").replace(/\/$/, "");
console.log("OK: correo verificado para", email);
console.log("Ya puedes iniciar sesión en", `${appUrl}/login`);
