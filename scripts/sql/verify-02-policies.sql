-- scripts/sql/verify-02-policies.sql
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_ai_credits', 'user_subscription_payments')
ORDER BY tablename, policyname;
