/**
 * Sends a test email via Resend using root .env
 * Usage: node scripts/send-test-email.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envText = readFileSync(resolve(root, ".env"), "utf8");
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
  env[line.slice(0, i).trim()] = value;
}

const apiKey = env.RESEND_API_KEY;
if (!apiKey) {
  console.error("Falta RESEND_API_KEY en el .env de la raiz del repo.");
  process.exit(1);
}

const from = env.EMAIL_FROM || env.RESEND_FROM || "Kitty <onboarding@resend.dev>";
const to = "luisalfonsoaraujoleon@gmail.com";

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from,
    to: [to],
    subject: "Prueba Kitty / Resend",
    html: "<p>Si lees esto, Resend funciona con este correo.</p>",
  }),
});

const body = await response.text();
console.log("status=", response.status);
console.log("body=", body);
if (!response.ok) process.exit(1);
console.log("OK: revisa Gmail y el panel Emails de Resend.");
