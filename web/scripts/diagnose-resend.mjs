import { readFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(dir, "../.env.vercel-check");
const envText = readFileSync(envPath, "utf8");
const env = {};
for (const raw of envText.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  let value = line.slice(i + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  // vercel env pull sometimes wraps in quotes already handled
  env[line.slice(0, i).trim()] = value;
}

console.log("has_RESEND=", Boolean(env.RESEND_API_KEY));
console.log("RESEND_len=", (env.RESEND_API_KEY || "").length);
console.log("EMAIL_FROM=", env.EMAIL_FROM || "(default)");
console.log("APP_URL=", env.APP_URL);

const from = env.EMAIL_FROM || "Kitty <onboarding@resend.dev>";
const to = "luisalfonsoaraujoleon@gmail.com";

const resendRes = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: "Prueba Kitty Resend",
    html: "<p>Prueba directa desde diagnostico. Si llega, Resend funciona.</p>",
  }),
});
const resendBody = await resendRes.text();
console.log("resend_status=", resendRes.status);
console.log("resend_body=", resendBody);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
const user = (list?.users || []).find((u) => (u.email || "").toLowerCase() === to);
console.log("auth_user_found=", Boolean(user));

if (user) {
  const redirectTo = `${(env.APP_URL || "https://kitty-azure-one.vercel.app").replace(/\/$/, "")}/auth/confirmed`;
  const magic = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: to,
    options: { redirectTo },
  });
  console.log("generateLink_error=", magic.error?.message || null);
  console.log("has_action_link=", Boolean(magic.data?.properties?.action_link));

  if (magic.data?.properties?.action_link) {
    const r2 = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Verifica tu correo en Kitty",
        html: `<p><a href="${magic.data.properties.action_link}">Verificar mi correo</a></p>`,
      }),
    });
    console.log("confirm_mail_status=", r2.status);
    console.log("confirm_mail_body=", await r2.text());
  }
}

try {
  unlinkSync(envPath);
  console.log("deleted_env_check_file=yes");
} catch {
  console.log("deleted_env_check_file=no");
}
