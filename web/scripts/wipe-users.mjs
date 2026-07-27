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

const tables = [
  "tagged_entry_messages",
  "entry_photos",
  "entry_tags",
  "remembered_entries",
  "weekly_streaks",
  "friendships",
  "diary_entries",
];

for (const table of tables) {
  const { error } = await sb.from(table).delete().neq("id", -1);
  console.log(`delete ${table}:`, error?.message || "ok");
}

await sb.from("users").update({ auth_id: null }).not("auth_id", "is", null);
const { error: usersError } = await sb.from("users").delete().neq("id", -1);
console.log("delete public.users:", usersError?.message || "ok");

const { data: authList } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
for (const user of authList?.users || []) {
  const { error } = await sb.auth.admin.deleteUser(user.id);
  console.log(`delete auth ${user.email}:`, error?.message || "ok");
}

const { count } = await sb.from("users").select("id", { count: "exact", head: true });
const { data: authAfter } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
console.log("AFTER public.users=", count ?? 0);
console.log("AFTER auth.users=", authAfter?.users?.length ?? 0);
