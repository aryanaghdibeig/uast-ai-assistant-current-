/**
 * Static verification of billing harden migrations (no DB required).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const harden = fs.readFileSync(
  path.join(root, "supabase/migrations/20260321120000_harden_billing_grants.sql"),
  "utf8"
);
const atomic = fs.readFileSync(
  path.join(root, "supabase/migrations/20260321130000_atomic_credit_usage.sql"),
  "utf8"
);
const mockUpgrade = fs.readFileSync(
  path.join(root, "app/api/billing/mock-upgrade/route.ts"),
  "utf8"
);
const proxy = fs.readFileSync(path.join(root, "proxy.ts"), "utf8");
const credits = fs.readFileSync(
  path.join(root, "lib/assistant/userCredits.ts"),
  "utf8"
);

const failures = [];

function assert(cond, msg) {
  if (!cond) failures.push(msg);
}

assert(
  /REVOKE INSERT, UPDATE, DELETE[\s\S]*ON TABLE public\.user_ai_credits[\s\S]*FROM authenticated/.test(
    harden
  ),
  "harden: authenticated write revoke on user_ai_credits"
);

assert(
  /REVOKE INSERT, UPDATE, DELETE[\s\S]*user_subscription_payments[\s\S]*FROM authenticated/.test(
    harden
  ),
  "harden: authenticated write revoke on payments"
);

assert(
  /target_user_id = auth\.uid\(\)/.test(harden),
  "harden: match_conversation_messages forces auth.uid()"
);

assert(
  /SECURITY DEFINER/.test(atomic) && /search_path TO 'public'/.test(atomic),
  "atomic: SECURITY DEFINER + search_path"
);

assert(
  /REVOKE ALL ON FUNCTION public\.increment_user_ai_credit_usage[\s\S]*FROM PUBLIC, anon, authenticated/.test(
    atomic
  ),
  "atomic: revoke execute from anon/authenticated"
);

assert(
  /GRANT EXECUTE ON FUNCTION public\.increment_user_ai_credit_usage[\s\S]*TO service_role/.test(
    atomic
  ),
  "atomic: grant execute to service_role only"
);

assert(
  /NODE_ENV ===\s*"production"/.test(mockUpgrade) &&
    /VERCEL_ENV ===\s*"production"/.test(mockUpgrade),
  "mock-upgrade: production guards"
);

assert(
  /\/api\/billing\/mock-upgrade/.test(proxy) &&
    /RESTRICTED_PRODUCTION_ROUTES/.test(proxy),
  "proxy: mock-upgrade restricted in production"
);

assert(
  /createSupabaseAdminClient/.test(credits) &&
    /getCreditsWriteClient/.test(credits),
  "credits: service-role write path"
);

assert(
  !/NEXT_PUBLIC_SUPABASE_SERVICE/.test(credits),
  "credits: no public service role env"
);

if (failures.length) {
  console.error("FAIL static security checks:");
  for (const f of failures) console.error(" -", f);
  process.exit(1);
}

console.log("PASS static security checks (10 assertions)");
