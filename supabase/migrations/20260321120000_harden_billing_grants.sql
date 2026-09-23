-- 20260321120000_harden_billing_grants.sql
-- Stage 1 — LOCAL/STAGING only until remote checklist is signed off.
--
-- Goals:
-- 1) Stop browser/PostgREST clients from escalating entitlements or faking payments
-- 2) Revoke dangerous TRUNCATE grants from anon
-- 3) Require app server (service role) for credit metering and mock billing writes
--
-- App code must use createSupabaseAdminClient() for INSERT/UPDATE on
-- user_ai_credits and user_subscription_payments (see lib/assistant/userCredits.ts).

BEGIN;

-- ---------------------------------------------------------------------------
-- user_ai_credits: authenticated SELECT only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_can_update_own_ai_credits" ON public.user_ai_credits;
DROP POLICY IF EXISTS "user_can_insert_own_ai_credits" ON public.user_ai_credits;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.user_ai_credits
  FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.user_ai_credits
  FROM anon;

GRANT SELECT ON TABLE public.user_ai_credits TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_ai_credits TO service_role;

-- Keep existing SELECT policy if present (user can read own row).
-- Ensure select policy exists:
DROP POLICY IF EXISTS "user_can_select_own_ai_credits" ON public.user_ai_credits;
CREATE POLICY "user_can_select_own_ai_credits"
  ON public.user_ai_credits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- user_subscription_payments: authenticated SELECT only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_can_insert_own_subscription_payments"
  ON public.user_subscription_payments;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.user_subscription_payments
  FROM authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.user_subscription_payments
  FROM anon;

GRANT SELECT ON TABLE public.user_subscription_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_subscription_payments TO service_role;

DROP POLICY IF EXISTS "user_can_select_own_subscription_payments"
  ON public.user_subscription_payments;
CREATE POLICY "user_can_select_own_subscription_payments"
  ON public.user_subscription_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Core tables: revoke TRUNCATE from anon
-- ---------------------------------------------------------------------------
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.conversations FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.conversation_branches FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.messages FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.conversation_memory_items FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.subscription_plans FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM anon;

-- ---------------------------------------------------------------------------
-- Semantic RPC: force target_user_id = auth.uid()
-- (Signature kept compatible with existing app call.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_conversation_messages(
  query_embedding extensions.vector,
  target_conversation_id uuid,
  target_user_id uuid,
  match_threshold double precision DEFAULT 0.35,
  match_count integer DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  role text,
  content text,
  created_at timestamp with time zone,
  similarity double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT
    messages.id,
    messages.role,
    messages.content,
    messages.created_at,
    (1 - (messages.embedding <=> query_embedding))::double precision AS similarity
  FROM public.messages
  WHERE messages.conversation_id = target_conversation_id
    AND messages.user_id = target_user_id
    AND target_user_id = auth.uid()
    AND messages.embedding IS NOT NULL
    AND (1 - (messages.embedding <=> query_embedding)) >= match_threshold
  ORDER BY messages.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;

COMMIT;
