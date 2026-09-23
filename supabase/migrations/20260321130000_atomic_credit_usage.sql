-- 20260321130000_atomic_credit_usage.sql
-- Stage 2 — LOCAL/STAGING only until remote checklist is signed off.
--
-- Atomic increment of trial/monthly token usage to reduce lost updates
-- under concurrent chat requests. Callable by service_role only.

BEGIN;

CREATE OR REPLACE FUNCTION public.increment_user_ai_credit_usage(
  p_user_id uuid,
  p_bucket text,
  p_tokens integer
)
RETURNS public.user_ai_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  updated_row public.user_ai_credits;
  tokens integer := GREATEST(COALESCE(p_tokens, 0), 0);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id required';
  END IF;

  IF tokens = 0 THEN
    SELECT * INTO updated_row
    FROM public.user_ai_credits
    WHERE user_id = p_user_id;

    RETURN updated_row;
  END IF;

  IF p_bucket = 'trial' THEN
    UPDATE public.user_ai_credits
    SET trial_tokens_used = trial_tokens_used + tokens
    WHERE user_id = p_user_id
    RETURNING * INTO updated_row;
  ELSIF p_bucket = 'monthly' THEN
    UPDATE public.user_ai_credits
    SET monthly_tokens_used = monthly_tokens_used + tokens
    WHERE user_id = p_user_id
    RETURNING * INTO updated_row;
  ELSE
    RAISE EXCEPTION 'invalid p_bucket: %', p_bucket;
  END IF;

  IF updated_row IS NULL THEN
    RAISE EXCEPTION 'user_ai_credits row not found for %', p_user_id;
  END IF;

  RETURN updated_row;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_user_ai_credit_usage(uuid, text, integer)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.increment_user_ai_credit_usage(uuid, text, integer)
  TO service_role;

COMMIT;
