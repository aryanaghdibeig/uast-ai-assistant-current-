-- 20260321140000_request_idempotency.sql
-- Stage: durable request idempotency (survives process restart / multi-instance).
-- LOCAL/STAGING only until remote checklist is signed off.
--
-- Unique claim: (user_id, operation, client_key)
-- Payload fingerprint mismatch => conflict (409 at app layer)
-- Statuses: running | completed | failed
-- Stale running rows may be reclaimed after lease expiry.

BEGIN;

CREATE TABLE IF NOT EXISTS public.request_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  operation text NOT NULL,
  client_key text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('running', 'completed', 'failed')),
  lease_expires_at timestamptz NOT NULL,
  result_ref jsonb,
  error_code text,
  tokens_debited integer NOT NULL DEFAULT 0
    CHECK (tokens_debited >= 0),
  usage_recorded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT request_idempotency_operation_key_chk
    CHECK (char_length(operation) BETWEEN 1 AND 64),
  CONSTRAINT request_idempotency_client_key_chk
    CHECK (char_length(client_key) BETWEEN 8 AND 128),
  CONSTRAINT request_idempotency_payload_hash_chk
    CHECK (char_length(payload_hash) BETWEEN 16 AND 128)
);

CREATE UNIQUE INDEX IF NOT EXISTS request_idempotency_user_op_key_uidx
  ON public.request_idempotency (user_id, operation, client_key);

CREATE INDEX IF NOT EXISTS request_idempotency_lease_idx
  ON public.request_idempotency (status, lease_expires_at);

ALTER TABLE public.request_idempotency ENABLE ROW LEVEL SECURITY;

-- Clients must not read/write idempotency store directly.
REVOKE ALL ON TABLE public.request_idempotency FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.request_idempotency TO service_role;

-- ---------------------------------------------------------------------------
-- Atomic claim / reclaim
-- Returns one row describing how the caller should proceed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_request_idempotency(
  p_user_id uuid,
  p_operation text,
  p_client_key text,
  p_payload_hash text,
  p_lease_seconds integer DEFAULT 120
)
RETURNS TABLE (
  outcome text,
  record_id uuid,
  status text,
  result_ref jsonb,
  tokens_debited integer,
  usage_recorded boolean,
  error_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  lease_secs integer := GREATEST(COALESCE(p_lease_seconds, 120), 30);
  existing public.request_idempotency%ROWTYPE;
  new_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_operation IS NULL OR p_client_key IS NULL OR p_payload_hash IS NULL THEN
    RAISE EXCEPTION 'claim_request_idempotency: required args missing';
  END IF;

  LOOP
    SELECT * INTO existing
    FROM public.request_idempotency AS r
    WHERE r.user_id = p_user_id
      AND r.operation = p_operation
      AND r.client_key = p_client_key
    FOR UPDATE;

    IF NOT FOUND THEN
      BEGIN
        INSERT INTO public.request_idempotency (
          user_id,
          operation,
          client_key,
          payload_hash,
          status,
          lease_expires_at
        ) VALUES (
          p_user_id,
          p_operation,
          p_client_key,
          p_payload_hash,
          'running',
          now() + make_interval(secs => lease_secs)
        )
        RETURNING id INTO new_id;

        RETURN QUERY
        SELECT
          'acquired'::text,
          new_id,
          'running'::text,
          NULL::jsonb,
          0,
          false,
          NULL::text;
        RETURN;
      EXCEPTION
        WHEN unique_violation THEN
          -- Concurrent insert won; retry loop to inspect winner.
          CONTINUE;
      END;
    END IF;

    IF existing.payload_hash <> p_payload_hash THEN
      RETURN QUERY
      SELECT
        'payload_conflict'::text,
        existing.id,
        existing.status,
        existing.result_ref,
        existing.tokens_debited,
        existing.usage_recorded,
        'idempotency_payload_mismatch'::text;
      RETURN;
    END IF;

    IF existing.status = 'completed' THEN
      RETURN QUERY
      SELECT
        'replay_completed'::text,
        existing.id,
        existing.status,
        existing.result_ref,
        existing.tokens_debited,
        existing.usage_recorded,
        existing.error_code;
      RETURN;
    END IF;

    IF existing.status = 'failed' THEN
      -- Failed attempts may be retried with same key+payload (network retry).
      UPDATE public.request_idempotency
      SET
        status = 'running',
        lease_expires_at = now() + make_interval(secs => lease_secs),
        error_code = NULL,
        updated_at = now()
      WHERE id = existing.id;

      RETURN QUERY
      SELECT
        'reclaimed'::text,
        existing.id,
        'running'::text,
        NULL::jsonb,
        existing.tokens_debited,
        existing.usage_recorded,
        NULL::text;
      RETURN;
    END IF;

    -- status = running
    IF existing.lease_expires_at < now() THEN
      UPDATE public.request_idempotency
      SET
        lease_expires_at = now() + make_interval(secs => lease_secs),
        updated_at = now()
      WHERE id = existing.id;

      RETURN QUERY
      SELECT
        'reclaimed'::text,
        existing.id,
        'running'::text,
        existing.result_ref,
        existing.tokens_debited,
        existing.usage_recorded,
        NULL::text;
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      'in_progress'::text,
      existing.id,
      existing.status,
      existing.result_ref,
      existing.tokens_debited,
      existing.usage_recorded,
      existing.error_code;
    RETURN;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_request_idempotency(
  p_record_id uuid,
  p_result_ref jsonb,
  p_tokens_debited integer DEFAULT 0,
  p_usage_recorded boolean DEFAULT false
)
RETURNS public.request_idempotency
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_row public.request_idempotency;
BEGIN
  UPDATE public.request_idempotency
  SET
    status = 'completed',
    result_ref = p_result_ref,
    tokens_debited = GREATEST(COALESCE(p_tokens_debited, 0), 0),
    usage_recorded = COALESCE(p_usage_recorded, false),
    error_code = NULL,
    updated_at = now()
  WHERE id = p_record_id
  RETURNING * INTO updated_row;

  IF updated_row IS NULL THEN
    RAISE EXCEPTION 'complete_request_idempotency: record not found';
  END IF;

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_request_idempotency(
  p_record_id uuid,
  p_error_code text DEFAULT 'failed'
)
RETURNS public.request_idempotency
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_row public.request_idempotency;
BEGIN
  UPDATE public.request_idempotency
  SET
    status = 'failed',
    error_code = COALESCE(NULLIF(trim(p_error_code), ''), 'failed'),
    updated_at = now()
  WHERE id = p_record_id
    AND status = 'running'
  RETURNING * INTO updated_row;

  RETURN updated_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_request_idempotency_usage(
  p_record_id uuid,
  p_tokens_debited integer
)
RETURNS public.request_idempotency
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_row public.request_idempotency;
BEGIN
  UPDATE public.request_idempotency
  SET
    usage_recorded = true,
    tokens_debited = GREATEST(COALESCE(p_tokens_debited, 0), 0),
    updated_at = now()
  WHERE id = p_record_id
    AND usage_recorded = false
  RETURNING * INTO updated_row;

  IF updated_row IS NULL THEN
    SELECT * INTO updated_row
    FROM public.request_idempotency
    WHERE id = p_record_id;
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_request_idempotency(uuid, text, text, text, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_request_idempotency(uuid, jsonb, integer, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_request_idempotency(uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_request_idempotency_usage(uuid, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_request_idempotency(uuid, text, text, text, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_request_idempotency(uuid, jsonb, integer, boolean)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_request_idempotency(uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_request_idempotency_usage(uuid, integer)
  TO service_role;

COMMIT;
