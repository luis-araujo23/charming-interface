import { readFileSync, existsSync, unlinkSync } from "node:fs";

const path = new URL("../.env.vercel-check", import.meta.url);
if (!existsSync(path)) {
  console.log("missing_env_file");
  process.exit(1);
}
const t = readFileSync(path, "utf8");
const line = t.split(/\r?\n/).find((l) => l.startsWith("RESEND_API_KEY="));
if (!line) {
  console.log("missing_key");
  process.exit(1);
}
let v = line.slice("RESEND_API_KEY=".length).trim();
if (
  (v.startsWith('"') && v.endsWith('"')) ||
  (v.startsWith("'") && v.endsWith("'"))
) {
  v = v.slice(1, -1);
}
console.log("raw_len=", v.length);
console.log("starts_with_re_=", v.startsWith("re_"));
console.log("has_spaces=", /\s/.test(v));
console.log("looks_placeholder=", /your|xxx|example|change|paste|aqui|aquí/i.test(v));
try {
  unlinkSync(path);
} catch {
  // ignore
}
