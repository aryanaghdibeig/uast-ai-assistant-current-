-- scripts/verify-billing-security-01-grants.sql
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('user_ai_credits', 'user_subscription_payments')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;
