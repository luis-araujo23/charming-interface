/**
 * Diagnose production mail config without printing secrets.
 * Uses pulled .env.vercel-check from `vercel env pull`.
 */
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(dir, "../.env.vercel-check");

function loadEnv(path) {
  const env = {};
  const text = readFileSync(path, "utf8");
  for (const raw of text.split(/\r?\n/)) {
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
    env[line.slice(0, i).trim()] = value;
  }
  return env;
}

if (!existsSync(envPath)) {
  console.log("missing_env_file");
  process.exit(1);
}

const env = loadEnv(envPath);
const report = {
  has_SMTP_HOST: Boolean(env.SMTP_HOST),
  has_SMTP_PORT: Boolean(env.SMTP_PORT),
  has_SMTP_USER: Boolean(env.SMTP_USER),
  has_SMTP_PASS: Boolean(env.SMTP_PASS),
  SMTP_HOST: env.SMTP_HOST || null,
  SMTP_PORT: env.SMTP_PORT || null,
  SMTP_USER_looks_email: Boolean(env.SMTP_USER && env.SMTP_USER.includes("@")),
  SMTP_PASS_len: env.SMTP_PASS ? env.SMTP_PASS.replace(/\s+/g, "").length : 0,
  EMAIL_FROM: env.EMAIL_FROM || null,
  APP_URL: env.APP_URL || null,
  has_RESEND: Boolean(env.RESEND_API_KEY && env.RESEND_API_KEY.startsWith("re_") && env.RESEND_API_KEY.length >= 20),
  RESEND_len: env.RESEND_API_KEY ? env.RESEND_API_KEY.length : 0,
};

console.log("config=", JSON.stringify(report, null, 2));

if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
  console.log("verdict=MISSING_SMTP_VARS");
  try {
    unlinkSync(envPath);
  } catch {}
  process.exit(2);
}

const pass = env.SMTP_PASS.replace(/\s+/g, "");
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT || 465),
  secure: Number(env.SMTP_PORT || 465) === 465,
  auth: { user: env.SMTP_USER, pass },
});

try {
  await transporter.verify();
  console.log("smtp_verify=OK");
} catch (e) {
  console.log("smtp_verify=FAIL");
  console.log("smtp_error=", e instanceof Error ? e.message : String(e));
  try {
    unlinkSync(envPath);
  } catch {}
  process.exit(3);
}

const to = "luisalfonsoaraujoleon@gmail.com";
const from = env.EMAIL_FROM || `Kitty <${env.SMTP_USER}>`;

try {
  const info = await transporter.sendMail({
    from,
    to,
    subject: "Prueba Kitty SMTP",
    html: "<p>Si lees esto, el SMTP de Vercel funciona.</p>",
  });
  console.log("smtp_send=OK");
  console.log("messageId=", info.messageId || "(none)");
} catch (e) {
  console.log("smtp_send=FAIL");
  console.log("smtp_send_error=", e instanceof Error ? e.message : String(e));
  try {
    unlinkSync(envPath);
  } catch {}
  process.exit(4);
}

// Also check generateLink works with production Supabase
try {
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 50 });
  const user = (list?.users || []).find((u) => (u.email || "").toLowerCase() === to);
  console.log("auth_user_exists=", Boolean(user));
  if (user) {
    const redirectTo = `${(env.APP_URL || "https://kitty-azure-one.vercel.app").replace(/\/$/, "")}/auth/confirmed`;
    const magic = await sb.auth.admin.generateLink({
      type: "magiclink",
      email: to,
      options: { redirectTo },
    });
    console.log("generateLink_ok=", !magic.error && Boolean(magic.data?.properties?.action_link));
    if (magic.error) console.log("generateLink_error=", magic.error.message);
  }
} catch (e) {
  console.log("supabase_check_error=", e instanceof Error ? e.message : String(e));
}

try {
  unlinkSync(envPath);
} catch {}
console.log("verdict=SMTP_WORKS");
