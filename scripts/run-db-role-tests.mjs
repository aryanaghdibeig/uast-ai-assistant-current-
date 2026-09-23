/**
 * Real DB role + idempotency tests against local Supabase.
 * Uses Auth Admin API + PostgREST as anon/authenticated — not only postgres superuser.
 *
 * Required env (local): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY — read from process env / .env.local without printing secrets.
 */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { readFileSync, existsSync } from "fs";
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
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("FAIL: missing local supabase env (url/anon/service)");
  process.exit(2);
}

const failures = [];
function pass(name) {
  console.log("PASS", name);
}
function fail(name, detail) {
  failures.push(`${name}: ${detail}`);
  console.error("FAIL", name, detail);
}

const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function userClient(accessToken) {
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hashPayload(obj) {
  return createHash("sha256")
    .update(JSON.stringify(obj, Object.keys(obj).sort()))
    .digest("hex");
}

async function createUser(email) {
  const password = "TestPass123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const { data: sessionData, error: signErr } =
    await createClient(url, anon).auth.signInWithPassword({
      email,
      password,
    });
  if (signErr) throw signErr;
  return {
    id: data.user.id,
    email,
    accessToken: sessionData.session.access_token,
  };
}

async function main() {
  const stamp = Date.now();
  const userA = await createUser(`idem-a-${stamp}@example.com`);
  const userB = await createUser(`idem-b-${stamp}@example.com`);
  const clientA = userClient(userA.accessToken);
  const clientB = userClient(userB.accessToken);

  // --- credits write denied for authenticated ---
  {
    const { error } = await clientA
      .from("user_ai_credits")
      .update({ trial_tokens_used: 999999 })
      .eq("user_id", userA.id);
    if (!error) fail("auth_cannot_update_credits", "update succeeded");
    else pass("auth_cannot_update_credits");
  }

  {
    const { error } = await clientA.from("user_subscription_payments").insert({
      user_id: userA.id,
      plan: "pro",
      amount: 1,
      currency: "IRR",
      status: "paid",
      provider: "mock",
    });
    if (!error) fail("auth_cannot_insert_payment", "insert succeeded");
    else pass("auth_cannot_insert_payment");
  }

  // --- RPC denied for authenticated ---
  {
    const { error } = await clientA.rpc("increment_user_ai_credit_usage", {
      p_user_id: userA.id,
      p_bucket: "trial",
      p_tokens: 1,
    });
    if (!error) fail("auth_cannot_execute_increment_rpc", "rpc succeeded");
    else pass("auth_cannot_execute_increment_rpc");
  }

  {
    const { error } = await clientA.rpc("claim_request_idempotency", {
      p_user_id: userA.id,
      p_operation: "chat.send",
      p_client_key: "abcdefgh",
      p_payload_hash: "x".repeat(32),
      p_lease_seconds: 60,
    });
    if (!error) fail("auth_cannot_execute_claim_rpc", "rpc succeeded");
    else pass("auth_cannot_execute_claim_rpc");
  }

  // Ensure credits rows via service (minimal required columns)
  await admin.from("user_ai_credits").upsert({
    user_id: userA.id,
    plan: "free",
    trial_token_limit: 100000,
    trial_tokens_used: 0,
    subscription_active: false,
    allowed_model_tier: "free",
    warning_shown: false,
    monthly_token_limit: 0,
    monthly_tokens_used: 0,
  });

  // --- cross-user conversation isolation ---
  const { data: convA, error: convErr } = await clientA
    .from("conversations")
    .insert({
      user_id: userA.id,
      title: "A private",
    })
    .select("id")
    .single();
  if (convErr) fail("create_conversation_a", convErr.message);
  else pass("create_conversation_a");

  if (convA?.id) {
    const { data: stolen, error: stealErr } = await clientB
      .from("conversations")
      .select("id,title")
      .eq("id", convA.id)
      .maybeSingle();
    if (stolen) fail("cross_user_conversation_read", "B saw A conversation");
    else pass("cross_user_conversation_read_blocked");

    const { error: msgSteal } = await clientB.from("messages").insert({
      conversation_id: convA.id,
      user_id: userB.id,
      role: "user",
      content: "intrusion",
    });
    // May fail on FK/RLS — either way B must not succeed owning A's thread
    if (!msgSteal) {
      // If insert somehow worked, clean up and fail
      fail("cross_user_message_insert", "B inserted into A conversation");
    } else pass("cross_user_message_insert_blocked");
  }

  // --- idempotency via service_role RPC ---
  const key = `key-${stamp}-abcdef`;
  const hash1 = hashPayload({ conversationId: convA?.id, message: "hi" });
  const hash2 = hashPayload({ conversationId: convA?.id, message: "other" });

  const claim1 = await admin.rpc("claim_request_idempotency", {
    p_user_id: userA.id,
    p_operation: "chat.send",
    p_client_key: key,
    p_payload_hash: hash1,
    p_lease_seconds: 120,
  });
  const row1 = Array.isArray(claim1.data) ? claim1.data[0] : claim1.data;
  if (claim1.error || row1?.outcome !== "acquired")
    fail("idem_claim_acquired", claim1.error?.message || row1?.outcome);
  else pass("idem_claim_acquired");

  const claimDup = await admin.rpc("claim_request_idempotency", {
    p_user_id: userA.id,
    p_operation: "chat.send",
    p_client_key: key,
    p_payload_hash: hash1,
    p_lease_seconds: 120,
  });
  const rowDup = Array.isArray(claimDup.data) ? claimDup.data[0] : claimDup.data;
  if (rowDup?.outcome !== "in_progress")
    fail("idem_concurrent_same_payload", rowDup?.outcome);
  else pass("idem_concurrent_same_payload_in_progress");

  const claimConflict = await admin.rpc("claim_request_idempotency", {
    p_user_id: userA.id,
    p_operation: "chat.send",
    p_client_key: key,
    p_payload_hash: hash2,
    p_lease_seconds: 120,
  });
  const rowConflict = Array.isArray(claimConflict.data)
    ? claimConflict.data[0]
    : claimConflict.data;
  if (rowConflict?.outcome !== "payload_conflict")
    fail("idem_payload_conflict", rowConflict?.outcome);
  else pass("idem_payload_conflict");

  const keyB = key; // same client key string, different user
  const claimB = await admin.rpc("claim_request_idempotency", {
    p_user_id: userB.id,
    p_operation: "chat.send",
    p_client_key: keyB,
    p_payload_hash: hash1,
    p_lease_seconds: 120,
  });
  const rowB = Array.isArray(claimB.data) ? claimB.data[0] : claimB.data;
  if (rowB?.outcome !== "acquired")
    fail("idem_key_scoped_per_user", rowB?.outcome);
  else pass("idem_key_scoped_per_user");

  if (row1?.record_id) {
    await admin.rpc("complete_request_idempotency", {
      p_record_id: row1.record_id,
      p_result_ref: { assistantContent: "done" },
      p_tokens_debited: 10,
      p_usage_recorded: true,
    });

    const claimReplay = await admin.rpc("claim_request_idempotency", {
      p_user_id: userA.id,
      p_operation: "chat.send",
      p_client_key: key,
      p_payload_hash: hash1,
      p_lease_seconds: 120,
    });
    const rowReplay = Array.isArray(claimReplay.data)
      ? claimReplay.data[0]
      : claimReplay.data;
    if (rowReplay?.outcome !== "replay_completed")
      fail("idem_replay_completed", rowReplay?.outcome);
    else pass("idem_replay_completed");

    const mark1 = await admin.rpc("mark_request_idempotency_usage", {
      p_record_id: row1.record_id,
      p_tokens_debited: 10,
    });
    if (mark1.error) fail("idem_usage_mark", mark1.error.message);
    else pass("idem_usage_mark_idempotent");
  }

  // cleanup users
  await admin.auth.admin.deleteUser(userA.id);
  await admin.auth.admin.deleteUser(userB.id);

  if (failures.length) {
    console.error("\nFAILED COUNT", failures.length);
    process.exit(1);
  }
  console.log("\nALL DB ROLE/IDEMPOTENCY TESTS PASSED");
}

main().catch((err) => {
  console.error("FATAL", err?.message || err);
  process.exit(1);
});
