import { readFileSync, unlinkSync, existsSync } from "node:fs";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

const envPath = new URL("../.env.vercel-check", import.meta.url);
if (!existsSync(envPath)) {
  console.log("missing_env");
  process.exit(1);
}

const env = {};
for (const raw of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  env[line.slice(0, i).trim()] = v;
}

const pass = (env.SMTP_PASS || "").replace(/\s+/g, "");
console.log(
  "precheck",
  JSON.stringify({
    hostIsGmail: env.SMTP_HOST === "smtp.gmail.com",
    userLen: (env.SMTP_USER || "").length,
    passLen: pass.length,
    fromSet: Boolean(env.EMAIL_FROM),
  }),
);

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT || 465),
  secure: true,
  auth: { user: env.SMTP_USER, pass },
});

try {
  await transporter.verify();
  console.log("verify=OK");
} catch (e) {
  console.log("verify=FAIL", e instanceof Error ? e.message : String(e));
  process.exit(2);
}

try {
  const info = await transporter.sendMail({
    from: env.EMAIL_FROM || `Kitty <${env.SMTP_USER}>`,
    to: "luisalfonsoaraujoleon@gmail.com",
    subject: "Kitty SMTP test " + new Date().toISOString(),
    html: "<p>Prueba directa SMTP. Si llega, el envio funciona.</p>",
  });
  console.log("send=OK", info.messageId || "");
} catch (e) {
  console.log("send=FAIL", e instanceof Error ? e.message : String(e));
  process.exit(3);
}

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const email = "luisalfonsoaraujoleon@gmail.com";
const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 100 });
const user = (list?.users || []).find((u) => (u.email || "").toLowerCase() === email);
console.log("authUser=", Boolean(user));

if (user) {
  const redirectTo =
    (env.APP_URL || "https://kitty-azure-one.vercel.app").replace(/\/$/, "") + "/auth/confirmed";
  const magic = await sb.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (magic.error) {
    console.log("generateLink=FAIL", magic.error.message);
  } else {
    console.log("generateLink=OK");
    const link = magic.data?.properties?.action_link;
    if (link) {
      const info2 = await transporter.sendMail({
        from: env.EMAIL_FROM || `Kitty <${env.SMTP_USER}>`,
        to: email,
        subject: "Verifica tu correo en Kitty",
        html: `<p><a href="${link}">Verificar mi correo</a></p><p>Enviado por diagnostico.</p>`,
      });
      console.log("confirmSend=OK", info2.messageId || "");
    }
  }
} else {
  console.log("no_auth_user_to_confirm");
}

try {
  unlinkSync(envPath);
} catch {}
