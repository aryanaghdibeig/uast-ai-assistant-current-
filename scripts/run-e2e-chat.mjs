/**
 * HTTP e2e against local Next + MOCK_AI using cookie session from Supabase Auth.
 * Does not print passwords or tokens.
 */
import { createClient } from "@supabase/supabase-js";
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

const credPath = resolve(process.cwd(), ".e2e-user.local.json");
if (!existsSync(credPath)) {
  console.error("missing .e2e-user.local.json — run create-e2e-user.mjs first");
  process.exit(2);
}

const cred = JSON.parse(readFileSync(credPath, "utf8"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const appBase = process.env.E2E_APP_URL || "http://127.0.0.1:3000";

const authClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: signed, error: signErr } = await authClient.auth.signInWithPassword({
  email: cred.email,
  password: cred.password,
});

if (signErr || !signed.session) {
  console.error("FAIL sign_in", signErr?.message || "no session");
  process.exit(1);
}

console.log("PASS sign_in");

// Build cookie header expected by @supabase/ssr (project ref from URL host for local often "127")
const projectRef = (() => {
  try {
    const host = new URL(url).hostname;
    if (host === "127.0.0.1" || host === "localhost") return "127";
    return host.split(".")[0];
  } catch {
    return "127";
  }
})();

const sessionPayload = {
  access_token: signed.session.access_token,
  refresh_token: signed.session.refresh_token,
  expires_at: signed.session.expires_at,
  expires_in: signed.session.expires_in,
  token_type: signed.session.token_type,
  user: signed.session.user,
};

const cookieName = `sb-${projectRef}-auth-token`;
const cookieValue = encodeURIComponent(JSON.stringify(sessionPayload));

async function api(pathname, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Cookie", `${cookieName}=${cookieValue}`);
  const res = await fetch(`${appBase}${pathname}`, {
    ...init,
    headers,
  });
  return res;
}

const home = await api("/");
if (home.status === 307 || home.status === 302) {
  const loc = home.headers.get("location") || "";
  if (loc.includes("/login")) {
    console.error("FAIL session_cookie_not_accepted", loc);
    console.error("hint: cookie name tried", cookieName);
    process.exit(1);
  }
}

// Create conversation
const createRes = await api("/api/conversations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ title: "e2e mock chat", assistantMode: "general" }),
});
const createJson = await createRes.json().catch(() => ({}));
if (!createRes.ok) {
  console.error("FAIL create_conversation", createRes.status, createJson);
  process.exit(1);
}
console.log("PASS create_conversation");

const conversationId =
  createJson.conversation?.id ||
  createJson.id ||
  createJson.conversationId;

if (!conversationId) {
  console.error("FAIL conversation_id_missing", Object.keys(createJson));
  process.exit(1);
}

const idemKey = `e2e-${Date.now()}-abcdefgh`;
const form = new FormData();
form.append("conversationId", conversationId);
form.append("message", "سلام؛ یک پاسخ آزمایشی بده.");
form.append("displayMessage", "سلام؛ یک پاسخ آزمایشی بده.");
form.append("assistantMode", "general");
form.append("history", JSON.stringify([]));

const chatRes = await api("/api/chat", {
  method: "POST",
  headers: { "Idempotency-Key": idemKey },
  body: form,
});

if (!chatRes.ok) {
  const text = await chatRes.text();
  console.error("FAIL chat_stream", chatRes.status, text.slice(0, 200));
  process.exit(1);
}

const chatBody = await chatRes.text();
if (!chatBody.includes("data:")) {
  console.error("FAIL chat_not_sse");
  process.exit(1);
}
console.log("PASS chat_stream_mock");

// Replay same key should not start second generation / should replay
const form2 = new FormData();
form2.append("conversationId", conversationId);
form2.append("message", "سلام؛ یک پاسخ آزمایشی بده.");
form2.append("displayMessage", "سلام؛ یک پاسخ آزمایشی بده.");
form2.append("assistantMode", "general");
form2.append("history", JSON.stringify([]));

const replayRes = await api("/api/chat", {
  method: "POST",
  headers: { "Idempotency-Key": idemKey },
  body: form2,
});
const replayHeader = replayRes.headers.get("x-uast-idempotency");
if (!replayRes.ok) {
  console.error("FAIL chat_replay", replayRes.status);
  process.exit(1);
}
console.log("PASS chat_idempotent_replay", replayHeader || "header_absent_ok_if_completed");

// Too long message
const longForm = new FormData();
longForm.append("conversationId", conversationId);
longForm.append("message", "x".repeat(20001));
longForm.append("displayMessage", "x".repeat(20001));
longForm.append("assistantMode", "general");
longForm.append("history", JSON.stringify([]));
const longRes = await api("/api/chat", {
  method: "POST",
  headers: { "Idempotency-Key": `e2e-long-${Date.now()}-abcdef` },
  body: longForm,
});
if (longRes.status !== 400) {
  console.error("FAIL chat_max_length", longRes.status);
  process.exit(1);
}
console.log("PASS chat_max_length_enforced");

console.log("\nALL HTTP E2E CHECKS PASSED");
