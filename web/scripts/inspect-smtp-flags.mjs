import { readFileSync, existsSync, unlinkSync } from "node:fs";

const path = new URL("../.env.vercel-check", import.meta.url);
if (!existsSync(path)) {
  console.log("missing_file");
  process.exit(1);
}
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

const host = env.SMTP_HOST || "";
const user = env.SMTP_USER || "";
const pass = (env.SMTP_PASS || "").replace(/\s+/g, "");
const from = env.EMAIL_FROM || "";

console.log(
  JSON.stringify(
    {
      host_is_gmail_smtp: host === "smtp.gmail.com",
      host_len: host.length,
      host_has_dot: host.includes("."),
      user_is_kitty_diary: user.toLowerCase() === "kitty.diaryapp@gmail.com",
      user_has_at: user.includes("@"),
      user_len: user.length,
      pass_len: pass.length,
      pass_is_16: pass.length === 16,
      from_contains_kitty_diary: from.toLowerCase().includes("kitty.diaryapp@gmail.com"),
      from_len: from.length,
    },
    null,
    2,
  ),
);

try {
  unlinkSync(path);
} catch {}
