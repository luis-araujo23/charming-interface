import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
const env = {};
for (const raw of envText.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
}

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data, count } = await sb.from("users").select("id, username, email, email_confirmed, created_at", { count: "exact" });
const { data: auth } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
console.log("public_count=", count);
console.log("public=", JSON.stringify(data));
console.log("auth=", JSON.stringify((auth?.users || []).map((u) => ({ email: u.email, confirmed: !!u.email_confirmed_at }))));
console.log("has_RESEND=", Boolean(env.RESEND_API_KEY));
console.log("has_EMAIL_FROM=", Boolean(env.EMAIL_FROM || env.RESEND_FROM));
