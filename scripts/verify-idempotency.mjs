/**
 * Unit checks for idempotency key/hash helpers (no DB, no path aliases).
 */
import { createHash } from "crypto";

function parseClientIdempotencyKey(headerValue) {
  if (!headerValue) return null;
  const key = headerValue.trim();
  if (!/^[a-zA-Z0-9._:-]{8,128}$/.test(key)) return null;
  return key;
}

function hashIdempotencyPayload(parts) {
  const normalized = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(normalized).digest("hex");
}

if (parseClientIdempotencyKey("short") !== null) {
  console.error("FAIL short key");
  process.exit(1);
}
if (parseClientIdempotencyKey("abcd-efgh-ijkl") === null) {
  console.error("FAIL valid key");
  process.exit(1);
}

const h1 = hashIdempotencyPayload({ a: 1, b: 2 });
const h2 = hashIdempotencyPayload({ b: 2, a: 1 });
const h3 = hashIdempotencyPayload({ a: 1, b: 3 });
if (h1 !== h2) {
  console.error("FAIL hash order instability");
  process.exit(1);
}
if (h1 === h3) {
  console.error("FAIL hash collision different payload");
  process.exit(1);
}

console.log("PASS usage idempotency unit checks (hash+key)");
