-- scripts/sql/verify-05-match-auth.sql
SELECT
  p.proname,
  pg_get_functiondef(p.oid) LIKE '%target_user_id = auth.uid()%' AS forces_auth_uid
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'match_conversation_messages';
