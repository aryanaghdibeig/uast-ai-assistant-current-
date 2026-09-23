-- scripts/sql/verify-04-definer.sql
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  COALESCE(p.proconfig, ARRAY[]::text[]) AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'increment_user_ai_credit_usage',
    'claim_request_idempotency',
    'complete_request_idempotency',
    'fail_request_idempotency',
    'mark_request_idempotency_usage'
  )
ORDER BY p.proname;
