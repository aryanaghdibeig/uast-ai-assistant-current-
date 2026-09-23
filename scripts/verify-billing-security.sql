-- scripts/verify-billing-security.sql
-- Non-destructive grant / policy / RPC checks for local ephemeral Supabase.
--
-- Usage (local only, after `npx supabase start` + migrations applied):
--   npx supabase db query --local -f scripts/verify-billing-security.sql
-- Or via psql on local port 54322 with the local DB password from `supabase status`
-- (do not paste passwords into chat logs).
--
-- Expected outcomes are annotated in comments. No DML / DROP / TRUNCATE.

-- ---------------------------------------------------------------------------
-- 1) Table privileges: authenticated must NOT write billing tables
-- ---------------------------------------------------------------------------
SELECT
  grantee,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('user_ai_credits', 'user_subscription_payments')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;
-- Expect authenticated: SELECT only
-- Expect anon: no INSERT/UPDATE/DELETE (ideally no row grants except none)
-- Expect service_role: SELECT, INSERT, UPDATE, DELETE

-- ---------------------------------------------------------------------------
-- 2) RLS policies on billing tables
-- ---------------------------------------------------------------------------
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_ai_credits', 'user_subscription_payments')
ORDER BY tablename, policyname;
-- Expect SELECT policies with auth.uid() = user_id
-- Expect NO INSERT/UPDATE/DELETE policies for authenticated

-- ---------------------------------------------------------------------------
-- 3) RPC execute privileges
-- ---------------------------------------------------------------------------
SELECT
  r.rolname AS grantee,
  has_function_privilege(
    r.oid,
    'public.increment_user_ai_credit_usage(uuid, text, integer)'::regprocedure,
    'EXECUTE'
  ) AS can_execute
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role', 'postgres');
-- Expect: anon=false, authenticated=false, service_role=true

-- ---------------------------------------------------------------------------
-- 4) SECURITY DEFINER + search_path hardening
-- ---------------------------------------------------------------------------
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_function_identity_arguments(p.oid) AS args,
  COALESCE(p.proconfig, ARRAY[]::text[]) AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'increment_user_ai_credit_usage';
-- Expect security_definer=true and config includes search_path=public

-- ---------------------------------------------------------------------------
-- 5) match_conversation_messages still forces target_user_id = auth.uid()
-- ---------------------------------------------------------------------------
SELECT
  p.proname,
  pg_get_functiondef(p.oid) LIKE '%target_user_id = auth.uid()%' AS forces_auth_uid
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'match_conversation_messages';
-- Expect forces_auth_uid=true

-- ---------------------------------------------------------------------------
-- 6) Optional atomicity smoke (safe: +0 tokens, no net change)
--    Run only as a role that may EXECUTE (service_role / postgres).
-- ---------------------------------------------------------------------------
-- SELECT public.increment_user_ai_credit_usage(
--   '<a-real-local-user-uuid>'::uuid,
--   'trial',
--   0
-- );
