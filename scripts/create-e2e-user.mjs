/**
 * Create a confirmed local auth user for e2e (prints only email, not password/tokens).
 * Usage: node --experimental-strip-types scripts/create-e2e-user.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  console.error("missing env");
  process.exit(1);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const email = `e2e-${stamp}@example.com`;
const password = `E2ePass-${stamp}!`;

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  console.error("create failed", error.message);
  process.exit(1);
}

const out = {
  email,
  password,
  userId: data.user.id,
  createdAt: new Date().toISOString(),
  note: "local e2e only — do not commit",
};

writeFileSync(
  resolve(process.cwd(), ".e2e-user.local.json"),
  JSON.stringify(out, null, 2)
);

console.log("e2e_user_email", email);
console.log("e2e_user_id", data.user.id);
console.log("credentials_file", ".e2e-user.local.json (gitignored)");
