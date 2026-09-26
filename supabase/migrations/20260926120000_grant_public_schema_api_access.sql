-- Hosted Supabase no longer grants API roles access to schema public.
-- Without USAGE, every authenticated query fails with
-- "permission denied for schema public", which is why production
-- conversations and credits fail while local Docker still works.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.conversations,
           public.conversation_branches,
           public.messages,
           public.conversation_memory_items
  TO authenticated;

GRANT SELECT ON TABLE public.subscription_plans TO anon, authenticated;

GRANT SELECT ON TABLE public.user_ai_credits TO authenticated;
GRANT SELECT ON TABLE public.user_subscription_payments TO authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.user_ai_credits
  FROM authenticated, anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON TABLE public.user_subscription_payments
  FROM authenticated, anon;

REVOKE ALL ON TABLE public.request_idempotency FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.request_idempotency TO service_role;

GRANT EXECUTE ON FUNCTION public.match_conversation_messages(
  extensions.vector,
  uuid,
  uuid,
  double precision,
  integer
) TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
