// lib/usage/idempotency.ts
// Durable request idempotency via Postgres (survives restart / multi-instance).
// Exactly-once provider calls are NOT claimed — only claim/complete of app-side effects.

import { createHash } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type IdempotencyOperation = "chat.send";

export type IdempotencyOutcome =
  | "acquired"
  | "reclaimed"
  | "replay_completed"
  | "in_progress"
  | "payload_conflict"
  | "missing_key";

export type IdempotencyClaim = {
  outcome: IdempotencyOutcome;
  recordId: string | null;
  status: string | null;
  resultRef: Record<string, unknown> | null;
  tokensDebited: number;
  usageRecorded: boolean;
  errorCode: string | null;
};

const CLIENT_KEY_RE = /^[a-zA-Z0-9._:-]{8,128}$/;
const DEFAULT_LEASE_SECONDS = 180;

function getAdmin() {
  return createSupabaseAdminClient();
}

export function parseClientIdempotencyKey(
  headerValue: string | null
): string | null {
  if (!headerValue) return null;
  const key = headerValue.trim();
  if (!CLIENT_KEY_RE.test(key)) return null;
  return key;
}

export function hashIdempotencyPayload(parts: Record<string, unknown>): string {
  const normalized = JSON.stringify(parts, Object.keys(parts).sort());
  return createHash("sha256").update(normalized).digest("hex");
}

export async function claimRequestIdempotency(input: {
  userId: string;
  operation: IdempotencyOperation;
  clientKey: string | null;
  payloadHash: string;
  leaseSeconds?: number;
}): Promise<IdempotencyClaim> {
  if (!input.clientKey) {
    return {
      outcome: "missing_key",
      recordId: null,
      status: null,
      resultRef: null,
      tokensDebited: 0,
      usageRecorded: false,
      errorCode: null,
    };
  }

  const { data, error } = await getAdmin().rpc("claim_request_idempotency", {
    p_user_id: input.userId,
    p_operation: input.operation,
    p_client_key: input.clientKey,
    p_payload_hash: input.payloadHash,
    p_lease_seconds: input.leaseSeconds ?? DEFAULT_LEASE_SECONDS,
  });

  if (error) {
    throw new Error(`claim_request_idempotency failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("claim_request_idempotency returned empty result");
  }

  return {
    outcome: row.outcome as IdempotencyOutcome,
    recordId: row.record_id ?? null,
    status: row.status ?? null,
    resultRef: (row.result_ref as Record<string, unknown> | null) ?? null,
    tokensDebited: Number(row.tokens_debited ?? 0),
    usageRecorded: Boolean(row.usage_recorded),
    errorCode: row.error_code ?? null,
  };
}

export async function completeRequestIdempotency(input: {
  recordId: string;
  resultRef: Record<string, unknown>;
  tokensDebited?: number;
  usageRecorded?: boolean;
}): Promise<void> {
  const { error } = await getAdmin().rpc("complete_request_idempotency", {
    p_record_id: input.recordId,
    p_result_ref: input.resultRef,
    p_tokens_debited: input.tokensDebited ?? 0,
    p_usage_recorded: input.usageRecorded ?? false,
  });

  if (error) {
    throw new Error(`complete_request_idempotency failed: ${error.message}`);
  }
}

export async function failRequestIdempotency(input: {
  recordId: string;
  errorCode?: string;
}): Promise<void> {
  const { error } = await getAdmin().rpc("fail_request_idempotency", {
    p_record_id: input.recordId,
    p_error_code: input.errorCode ?? "failed",
  });

  if (error) {
    console.error("fail_request_idempotency:", error.message);
  }
}

/**
 * Records that usage was debited for this idempotency row.
 * Returns false if usage was already recorded (skip second debit).
 */
export async function markRequestIdempotencyUsage(input: {
  recordId: string;
  tokensDebited: number;
}): Promise<{ alreadyRecorded: boolean }> {
  const admin = getAdmin();

  const { data: before } = await admin
    .from("request_idempotency")
    .select("usage_recorded")
    .eq("id", input.recordId)
    .maybeSingle();

  if (before?.usage_recorded === true) {
    return { alreadyRecorded: true };
  }

  const { error } = await admin.rpc("mark_request_idempotency_usage", {
    p_record_id: input.recordId,
    p_tokens_debited: input.tokensDebited,
  });

  if (error) {
    throw new Error(`mark_request_idempotency_usage failed: ${error.message}`);
  }

  return { alreadyRecorded: false };
}

/** @deprecated process-local helpers removed — kept names for script compatibility stubs */
export function buildUsageIdempotencyKey(
  userId: string,
  clientKey: string
): string {
  return `${userId}::${clientKey}`;
}
