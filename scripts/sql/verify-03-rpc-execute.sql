-- scripts/sql/verify-03-rpc-execute.sql
SELECT
  r.rolname AS grantee,
  has_function_privilege(
    r.oid,
    'public.increment_user_ai_credit_usage(uuid, text, integer)'::regprocedure,
    'EXECUTE'
  ) AS can_execute_increment,
  has_function_privilege(
    r.oid,
    'public.claim_request_idempotency(uuid, text, text, text, integer)'::regprocedure,
    'EXECUTE'
  ) AS can_execute_claim
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY r.rolname;
