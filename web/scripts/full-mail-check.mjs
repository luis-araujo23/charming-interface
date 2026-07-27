/**
 * Full mail diagnosis: env flags + SMTP verify/send + generateLink + optional API probe.
 * Does not print secret values.
 */
import { readFileSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(dir, "../.env.vercel-check");

function loadEnv(path) {
  const env = {};
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[line.slice(0, i).trim()] = v;
  }
  return env;
}

function flags(env) {
  const host = env.SMTP_HOST || "";
  const user = env.SMTP_USER || "";
  const pass = (env.SMTP_PASS || "").replace(/\s+/g, "");
  const from = env.EMAIL_FROM || "";
  return {
    host_ok: host === "smtp.gmail.com",
    host_len: host.length,
    port: env.SMTP_PORT || null,
    user_ok: user.toLowerCase() === "kitty.diaryapp@gmail.com",
    user_has_at: user.includes("@"),
    pass_len: pass.length,
    pass_ok: pass.length === 16,
    from_ok: from.toLowerCase().includes("kitty.diaryapp@gmail.com"),
    app_url: env.APP_URL || null,
    has_supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

if (!existsSync(envPath)) {
  console.log(JSON.stringify({ error: "missing_env_file" }));
  process.exit(1);
}

const env = loadEnv(envPath);
const f = flags(env);
console.log("flags=", JSON.stringify(f, null, 2));

const result = { smtp_verify: null, smtp_send: null, generateLink: null, api_resend: null };

if (f.host_ok && f.user_has_at && f.pass_ok) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 465),
    secure: Number(env.SMTP_PORT || 465) === 465,
    auth: { user: env.SMTP_USER, pass: (env.SMTP_PASS || "").replace(/\s+/g, "") },
  });

  try {
    await transporter.verify();
    result.smtp_verify = "OK";
  } catch (e) {
    result.smtp_verify = "FAIL: " + (e instanceof Error ? e.message : String(e));
  }

  if (result.smtp_verify === "OK") {
    try {
      const info = await transporter.sendMail({
        from: env.EMAIL_FROM || `Kitty <${env.SMTP_USER}>`,
        to: "luisalfonsoaraujoleon@gmail.com",
        subject: "Kitty diagnostico SMTP " + new Date().toISOString(),
        html: "<p>Diagnostico: si llega este correo, SMTP funciona fuera de la app.</p>",
      });
      result.smtp_send = "OK messageId=" + (info.messageId || "?");
    } catch (e) {
      result.smtp_send = "FAIL: " + (e instanceof Error ? e.message : String(e));
    }
  }
} else {
  result.smtp_verify = "SKIPPED_BAD_FLAGS";
  result.smtp_send = "SKIPPED_BAD_FLAGS";
}

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const email = "luisalfonsoaraujoleon@gmail.com";
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 100 });
    const user = (list?.users || []).find((u) => (u.email || "").toLowerCase() === email);
    result.auth_user_exists = Boolean(user);
    result.public_check = null;

    const { data: pub, count } = await sb
      .from("users")
      .select("id, email, email_confirmed", { count: "exact" });
    result.public_users_count = count ?? pub?.length ?? 0;
    result.public_has_target = (pub || []).some((u) => (u.email || "").toLowerCase() === email);

    if (user) {
      const redirectTo = `${(env.APP_URL || "https://kitty-azure-one.vercel.app").replace(/\/$/, "")}/auth/confirmed`;
      const magic = await sb.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      result.generateLink = magic.error
        ? "FAIL: " + magic.error.message
        : magic.data?.properties?.action_link
          ? "OK"
          : "FAIL: no action_link";
    } else {
      result.generateLink = "SKIPPED_NO_AUTH_USER";
    }
  } catch (e) {
    result.supabase = "FAIL: " + (e instanceof Error ? e.message : String(e));
  }
}

// Probe production API health with a bogus password to see if route exists / error shape
try {
  const res = await fetch("https://kitty-azure-one.vercel.app/api/auth/resend-confirmation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "luisalfonsoaraujoleon@gmail.com",
      password: "__probe_wrong_password__",
    }),
  });
  const text = await res.text();
  result.api_resend = { status: res.status, body: text.slice(0, 300) };
} catch (e) {
  result.api_resend = "FAIL: " + (e instanceof Error ? e.message : String(e));
}

console.log("result=", JSON.stringify(result, null, 2));

try {
  unlinkSync(envPath);
} catch {}

// Write a tiny marker for the agent (no secrets)
writeFileSync(
  resolve(dir, "last-mail-check.json"),
  JSON.stringify({ flags: f, result }, null, 2),
);
