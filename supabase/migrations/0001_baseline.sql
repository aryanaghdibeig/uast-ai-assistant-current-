SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE SCHEMA IF NOT EXISTS "public";

-- Extensions
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- Functions
CREATE OR REPLACE FUNCTION "public"."assign_message_to_active_branch"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.branch_id is null then
    select
      conversations.active_branch_id
    into
      new.branch_id
    from public.conversations
    where conversations.id =
      new.conversation_id;
  end if;

  if new.branch_id is not null
    and not exists (
      select 1
      from public.conversation_branches
      where
        conversation_branches.id =
          new.branch_id
        and conversation_branches.conversation_id =
          new.conversation_id
    )
  then
    raise exception
      'Selected branch does not belong to this conversation.';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."assign_message_to_active_branch"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_initial_conversation_branch"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  created_branch_id uuid;
begin
  insert into public.conversation_branches (
    conversation_id,
    user_id,
    title,
    branch_order
  )
  values (
    new.id,
    new.user_id,
    'شاخه اصلی',
    1
  )
  on conflict (
    conversation_id,
    branch_order
  )
  do update
  set updated_at = now()
  returning id
  into created_branch_id;

  update public.conversations
  set active_branch_id =
    created_branch_id
  where id = new.id;

  return new;
end;
$$;

ALTER FUNCTION "public"."create_initial_conversation_branch"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."match_conversation_messages"("query_embedding" "extensions"."vector", "target_conversation_id" "uuid", "target_user_id" "uuid", "match_threshold" double precision DEFAULT 0.35, "match_count" integer DEFAULT 8) RETURNS TABLE("id" "uuid", "role" "text", "content" "text", "created_at" timestamp with time zone, "similarity" double precision)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
  select
    messages.id,
    messages.role,
    messages.content,
    messages.created_at,
    (
      1 -
      (
        messages.embedding
        <=>
        query_embedding
      )
    )
    ::
    double precision
    as similarity
  from
    public.messages
  where
    messages.conversation_id =
    target_conversation_id
  and
    messages.user_id =
    target_user_id
  and
    messages.embedding
    is not null
  and
    (
      1 -
      (
        messages.embedding
        <=>
        query_embedding
      )
    )
    >=
    match_threshold
  order by
    messages.embedding
    <=>
    query_embedding
  limit
    least(
      greatest(
        match_count,
        1
      ),
      20
    );
$$;

ALTER FUNCTION "public"."match_conversation_messages"("query_embedding" "extensions"."vector", "target_conversation_id" "uuid", "target_user_id" "uuid", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_subscription_plan_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_subscription_plan_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_conversation_branch_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

ALTER FUNCTION "public"."update_conversation_branch_timestamp"() OWNER TO "postgres";

-- Tables

CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'گفتگوی جدید'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "assistant_mode" "text" DEFAULT 'general'::"text" NOT NULL,
    "conversation_summary" "text" DEFAULT ''::"text" NOT NULL,
    "summary_message_count" integer DEFAULT 0 NOT NULL,
    "summary_updated_at" timestamp with time zone,
    "behavior_profile" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "behavior_profile_updated_at" timestamp with time zone,
    "memory_enabled" boolean DEFAULT true NOT NULL,
    "selected_model" "text" DEFAULT 'openrouter/auto'::"text" NOT NULL,
    "model_selection_mode" "text" DEFAULT 'auto'::"text" NOT NULL,
    "model_preferences" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "model_updated_at" timestamp with time zone,
    "active_branch_id" "uuid",
    CONSTRAINT "conversations_assistant_mode_check" CHECK (("assistant_mode" = ANY (ARRAY['general'::"text", 'official_letter'::"text", 'curriculum'::"text", 'research'::"text", 'content'::"text", 'planning'::"text", 'analysis'::"text"]))),
    CONSTRAINT "conversations_behavior_profile_object_check" CHECK (("jsonb_typeof"("behavior_profile") = 'object'::"text")),
    CONSTRAINT "conversations_model_selection_mode_check" CHECK (("model_selection_mode" = ANY (ARRAY['auto'::"text", 'preset'::"text", 'advanced'::"text"]))),
    CONSTRAINT "conversations_summary_message_count_check" CHECK (("summary_message_count" >= 0))
);

ALTER TABLE "public"."conversations" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."conversation_branches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_branch_id" "uuid",
    "forked_from_message_id" "uuid",
    "title" "text" DEFAULT 'شاخه اصلی'::"text" NOT NULL,
    "branch_order" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversation_branches_conversation_order_key" UNIQUE ("conversation_id", "branch_order"),
    CONSTRAINT "conversation_branches_branch_order_check" CHECK (("branch_order" > 0))
);

ALTER TABLE "public"."conversation_branches" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."conversation_memory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "memory_type" "text" NOT NULL,
    "memory_key" "text" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" NOT NULL,
    "value_json" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "importance" smallint DEFAULT 3 NOT NULL,
    "confidence" numeric(4,3) DEFAULT 1.000 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    "source_message_ids" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "supersedes_id" "uuid",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_confirmed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "conversation_memory_items_confidence_check" CHECK ((("confidence" >= (0)::numeric) AND ("confidence" <= (1)::numeric))),
    CONSTRAINT "conversation_memory_items_content_not_empty_check" CHECK (("length"(TRIM(BOTH FROM "content")) > 0)),
    CONSTRAINT "conversation_memory_items_importance_check" CHECK ((("importance" >= 1) AND ("importance" <= 5))),
    CONSTRAINT "conversation_memory_items_key_not_empty_check" CHECK (("length"(TRIM(BOTH FROM "memory_key")) > 0)),
    CONSTRAINT "conversation_memory_items_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'resolved'::"text", 'superseded'::"text", 'archived'::"text"]))),
    CONSTRAINT "conversation_memory_items_type_check" CHECK (("memory_type" = ANY (ARRAY['topic'::"text", 'fact'::"text", 'goal'::"text", 'decision'::"text", 'constraint'::"text", 'number'::"text", 'deadline'::"text", 'preference'::"text", 'instruction'::"text", 'open_task'::"text", 'entity'::"text", 'reference'::"text", 'outcome'::"text"]))),
    CONSTRAINT "conversation_memory_items_value_json_object_check" CHECK (("jsonb_typeof"("value_json") = 'object'::"text"))
);

ALTER TABLE "public"."conversation_memory_items" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "conversation_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1536),
    "embedding_model" "text",
    "embedding_dimensions" integer,
    "embedding_content_hash" "text",
    "embedded_at" timestamp with time zone,
    "branch_id" "uuid",
    CONSTRAINT "messages_embedding_dimensions_check" CHECK ((("embedding_dimensions" IS NULL) OR ("embedding_dimensions" = 1536))),
    CONSTRAINT "messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);

ALTER TABLE "public"."messages" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."subscription_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "code" "text" NOT NULL UNIQUE,
    "title" "text" NOT NULL,
    "description" "text",
    "price_amount" bigint DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'IRR'::"text" NOT NULL,
    "duration_days" integer NOT NULL,
    "monthly_token_limit" integer NOT NULL,
    "allowed_model_tier" "text" DEFAULT 'main'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "subscription_plans_allowed_model_tier_check" CHECK (("allowed_model_tier" = ANY (ARRAY['free'::"text", 'main'::"text", 'advanced'::"text", 'all'::"text"]))),
    CONSTRAINT "subscription_plans_duration_days_check" CHECK (("duration_days" > 0)),
    CONSTRAINT "subscription_plans_monthly_token_limit_check" CHECK (("monthly_token_limit" > 0)),
    CONSTRAINT "subscription_plans_price_amount_check" CHECK (("price_amount" >= 0))
);

ALTER TABLE "public"."subscription_plans" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_ai_credits" (
    "user_id" "uuid" NOT NULL PRIMARY KEY,
    "plan" "text" DEFAULT 'trial'::"text" NOT NULL,
    "trial_token_limit" integer DEFAULT 100000 NOT NULL,
    "trial_tokens_used" integer DEFAULT 0 NOT NULL,
    "subscription_active" boolean DEFAULT false NOT NULL,
    "allowed_model_tier" "text" DEFAULT 'main'::"text" NOT NULL,
    "warning_shown" boolean DEFAULT false NOT NULL,
    "last_auto_downgrade_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subscription_started_at" timestamp with time zone,
    "subscription_expires_at" timestamp with time zone,
    "monthly_token_limit" integer DEFAULT 0 NOT NULL,
    "monthly_tokens_used" integer DEFAULT 0 NOT NULL,
    "monthly_period_started_at" timestamp with time zone,
    "payment_provider" "text",
    "payment_reference_id" "text",
    "subscription_note" "text",
    "access_mode_preference" "text" DEFAULT 'auto'::"text" NOT NULL,
    "last_access_mode_change_at" timestamp with time zone,
    CONSTRAINT "user_ai_credits_access_mode_preference_check" CHECK (("access_mode_preference" = ANY (ARRAY['auto'::"text", 'subscription'::"text", 'free'::"text"]))),
    CONSTRAINT "user_ai_credits_allowed_model_tier_check" CHECK (("allowed_model_tier" = ANY (ARRAY['free'::"text", 'main'::"text", 'advanced'::"text", 'all'::"text"]))),
    CONSTRAINT "user_ai_credits_monthly_token_limit_check" CHECK (("monthly_token_limit" >= 0)),
    CONSTRAINT "user_ai_credits_monthly_tokens_used_check" CHECK (("monthly_tokens_used" >= 0)),
    CONSTRAINT "user_ai_credits_plan_check" CHECK (("plan" = ANY (ARRAY['trial'::"text", 'free'::"text", 'pro'::"text", 'admin'::"text"]))),
    CONSTRAINT "user_ai_credits_trial_token_limit_check" CHECK (("trial_token_limit" >= 0)),
    CONSTRAINT "user_ai_credits_trial_tokens_used_check" CHECK (("trial_tokens_used" >= 0))
);

ALTER TABLE "public"."user_ai_credits" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."user_subscription_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "user_id" "uuid" NOT NULL,
    "plan" "text" DEFAULT 'pro'::"text" NOT NULL,
    "amount" integer DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'IRR'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider" "text",
    "provider_reference_id" "text",
    "checkout_url" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_subscription_payments_amount_check" CHECK (("amount" >= 0)),
    CONSTRAINT "user_subscription_payments_plan_check" CHECK (("plan" = ANY (ARRAY['pro'::"text", 'admin'::"text"]))),
    CONSTRAINT "user_subscription_payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'cancelled'::"text", 'refunded'::"text"])))
);

ALTER TABLE "public"."user_subscription_payments" OWNER TO "postgres";

-- Indexes

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_memory_items_active_key_unique_idx" ON "public"."conversation_memory_items" USING "btree" ("conversation_id", "memory_key") WHERE ("status" = 'active'::"text");
CREATE INDEX IF NOT EXISTS "conversation_memory_items_conversation_id_idx" ON "public"."conversation_memory_items" USING "btree" ("conversation_id");
CREATE INDEX IF NOT EXISTS "conversation_memory_items_pinned_idx" ON "public"."conversation_memory_items" USING "btree" ("conversation_id", "is_pinned") WHERE ("is_pinned" = true);
CREATE INDEX IF NOT EXISTS "conversation_memory_items_priority_idx" ON "public"."conversation_memory_items" USING "btree" ("conversation_id", "importance" DESC, "updated_at" DESC) WHERE ("status" = 'active'::"text");
CREATE INDEX IF NOT EXISTS "conversation_memory_items_status_idx" ON "public"."conversation_memory_items" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "conversation_memory_items_type_idx" ON "public"."conversation_memory_items" USING "btree" ("memory_type");
CREATE INDEX IF NOT EXISTS "conversation_memory_items_user_id_idx" ON "public"."conversation_memory_items" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "conversations_updated_at_idx" ON "public"."conversations" USING "btree" ("updated_at" DESC);
CREATE INDEX IF NOT EXISTS "conversations_user_id_idx" ON "public"."conversations" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_conversation_branches_conversation_id" ON "public"."conversation_branches" USING "btree" ("conversation_id");
CREATE INDEX IF NOT EXISTS "idx_conversation_branches_parent_branch_id" ON "public"."conversation_branches" USING "btree" ("parent_branch_id");
CREATE INDEX IF NOT EXISTS "idx_conversation_branches_user_id" ON "public"."conversation_branches" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_conversations_active_branch_id" ON "public"."conversations" USING "btree" ("active_branch_id");

CREATE INDEX IF NOT EXISTS "idx_messages_branch_id" ON "public"."messages" USING "btree" ("branch_id");
CREATE INDEX IF NOT EXISTS "messages_conversation_id_idx" ON "public"."messages" USING "btree" ("conversation_id");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "public"."messages" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "messages_embedding_hnsw_idx" ON "public"."messages" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WHERE ("embedding" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "messages_embedding_model_idx" ON "public"."messages" USING "btree" ("embedding_model") WHERE ("embedding" IS NOT NULL);
CREATE INDEX IF NOT EXISTS "messages_embedding_pending_idx" ON "public"."messages" USING "btree" ("conversation_id", "created_at") WHERE ("embedding" IS NULL);
CREATE INDEX IF NOT EXISTS "messages_user_id_idx" ON "public"."messages" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_subscription_plans_active" ON "public"."subscription_plans" USING "btree" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_subscription_plans_sort_order" ON "public"."subscription_plans" USING "btree" ("sort_order");

CREATE INDEX IF NOT EXISTS "idx_user_ai_credits_plan" ON "public"."user_ai_credits" USING "btree" ("plan");
CREATE INDEX IF NOT EXISTS "idx_user_ai_credits_subscription_active" ON "public"."user_ai_credits" USING "btree" ("subscription_active");
CREATE INDEX IF NOT EXISTS "idx_user_ai_credits_subscription_expires_at" ON "public"."user_ai_credits" USING "btree" ("subscription_expires_at");

CREATE INDEX IF NOT EXISTS "idx_user_subscription_payments_created_at" ON "public"."user_subscription_payments" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_user_subscription_payments_status" ON "public"."user_subscription_payments" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "idx_user_subscription_payments_user_id" ON "public"."user_subscription_payments" USING "btree" ("user_id");

-- Triggers

DROP TRIGGER IF EXISTS "conversation_memory_items_set_updated_at" ON "public"."conversation_memory_items";
CREATE TRIGGER "conversation_memory_items_set_updated_at" BEFORE UPDATE ON "public"."conversation_memory_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

DROP TRIGGER IF EXISTS "conversations_set_updated_at" ON "public"."conversations";
CREATE TRIGGER "conversations_set_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

DROP TRIGGER IF EXISTS "trg_assign_message_to_active_branch" ON "public"."messages";
CREATE TRIGGER "trg_assign_message_to_active_branch" BEFORE INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."assign_message_to_active_branch"();

DROP TRIGGER IF EXISTS "trg_create_initial_conversation_branch" ON "public"."conversations";
CREATE TRIGGER "trg_create_initial_conversation_branch" AFTER INSERT ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."create_initial_conversation_branch"();

DROP TRIGGER IF EXISTS "trg_subscription_plans_updated_at" ON "public"."subscription_plans";
CREATE TRIGGER "trg_subscription_plans_updated_at" BEFORE UPDATE ON "public"."subscription_plans" FOR EACH ROW EXECUTE FUNCTION "public"."set_subscription_plan_updated_at"();

DROP TRIGGER IF EXISTS "trg_update_conversation_branch_timestamp" ON "public"."conversation_branches";
CREATE TRIGGER "trg_update_conversation_branch_timestamp" BEFORE UPDATE ON "public"."conversation_branches" FOR EACH ROW EXECUTE FUNCTION "public"."update_conversation_branch_timestamp"();

DROP TRIGGER IF EXISTS "trg_user_ai_credits_updated_at" ON "public"."user_ai_credits";
CREATE TRIGGER "trg_user_ai_credits_updated_at" BEFORE UPDATE ON "public"."user_ai_credits" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

DROP TRIGGER IF EXISTS "trg_user_subscription_payments_updated_at" ON "public"."user_subscription_payments";
CREATE TRIGGER "trg_user_subscription_payments_updated_at" BEFORE UPDATE ON "public"."user_subscription_payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

-- Foreign Keys (Safely created only if not exists)

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_branches_conversation_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversation_branches"
            ADD CONSTRAINT "conversation_branches_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_branches_forked_from_message_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversation_branches"
            ADD CONSTRAINT "conversation_branches_forked_from_message_id_fkey" FOREIGN KEY ("forked_from_message_id") REFERENCES "public"."messages"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_branches_parent_branch_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversation_branches"
            ADD CONSTRAINT "conversation_branches_parent_branch_id_fkey" FOREIGN KEY ("parent_branch_id") REFERENCES "public"."conversation_branches"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_branches_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversation_branches"
            ADD CONSTRAINT "conversation_branches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_memory_items_conversation_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversation_memory_items"
            ADD CONSTRAINT "conversation_memory_items_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_memory_items_supersedes_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversation_memory_items"
            ADD CONSTRAINT "conversation_memory_items_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "public"."conversation_memory_items"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_memory_items_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversation_memory_items"
            ADD CONSTRAINT "conversation_memory_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_active_branch_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversations"
            ADD CONSTRAINT "conversations_active_branch_id_fkey" FOREIGN KEY ("active_branch_id") REFERENCES "public"."conversation_branches"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."conversations"
            ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_branch_id_fkey') THEN
        ALTER TABLE ONLY "public"."messages"
            ADD CONSTRAINT "messages_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "public"."conversation_branches"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_fkey') THEN
        ALTER TABLE ONLY "public"."messages"
            ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."messages"
            ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_ai_credits_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."user_ai_credits"
            ADD CONSTRAINT "user_ai_credits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_subscription_payments_user_id_fkey') THEN
        ALTER TABLE ONLY "public"."user_subscription_payments"
            ADD CONSTRAINT "user_subscription_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- RLS & Policies

ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."conversation_branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."conversation_memory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_ai_credits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."user_subscription_payments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view active plans" ON "public"."subscription_plans";
CREATE POLICY "Authenticated users can view active plans" ON "public"."subscription_plans" FOR SELECT TO "authenticated" USING (("is_active" = true));

DROP POLICY IF EXISTS "Users can create their own conversation memory" ON "public"."conversation_memory_items";
CREATE POLICY "Users can create their own conversation memory" ON "public"."conversation_memory_items" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1 FROM "public"."conversations" WHERE (("conversations"."id" = "conversation_memory_items"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"()))))));

DROP POLICY IF EXISTS "Users can delete their own conversation memory" ON "public"."conversation_memory_items";
CREATE POLICY "Users can delete their own conversation memory" ON "public"."conversation_memory_items" FOR DELETE USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1 FROM "public"."conversations" WHERE (("conversations"."id" = "conversation_memory_items"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"()))))));

DROP POLICY IF EXISTS "Users can update their own conversation memory" ON "public"."conversation_memory_items";
CREATE POLICY "Users can update their own conversation memory" ON "public"."conversation_memory_items" FOR UPDATE USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1 FROM "public"."conversations" WHERE (("conversations"."id" = "conversation_memory_items"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"())))))) WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1 FROM "public"."conversations" WHERE (("conversations"."id" = "conversation_memory_items"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"()))))));

DROP POLICY IF EXISTS "Users can view their own conversation memory" ON "public"."conversation_memory_items";
CREATE POLICY "Users can view their own conversation memory" ON "public"."conversation_memory_items" FOR SELECT USING ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1 FROM "public"."conversations" WHERE (("conversations"."id" = "conversation_memory_items"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"()))))));

DROP POLICY IF EXISTS "Users can create their own conversations" ON "public"."conversations";
CREATE POLICY "Users can create their own conversations" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can delete their own conversations" ON "public"."conversations";
CREATE POLICY "Users can delete their own conversations" ON "public"."conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can update their own conversations" ON "public"."conversations";
CREATE POLICY "Users can update their own conversations" ON "public"."conversations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can view their own conversations" ON "public"."conversations";
CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));

DROP POLICY IF EXISTS "Users can create their own messages" ON "public"."messages";
CREATE POLICY "Users can create their own messages" ON "public"."messages" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") AND (EXISTS ( SELECT 1 FROM "public"."conversations" WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = "auth"."uid"()))))));

DROP POLICY IF EXISTS "Users can delete their own messages" ON "public"."messages";
CREATE POLICY "Users can delete their own messages" ON "public"."messages" 