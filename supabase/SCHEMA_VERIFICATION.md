# Schema verification checklist (P0-A1 → gate for P0-A2)

Complete this checklist against the **live / staging Supabase project** before creating any baseline migration SQL (P0-A2).

Do not invent columns from application TypeScript alone. Code references are **hints**; the database is the source of truth.

---

## A. Connection and inventory

- [ ] Confirm project URL matches `NEXT_PUBLIC_SUPABASE_URL` used by this app.
- [ ] List all schemas in use (`public`, `extensions`, others).
- [ ] List all tables in `public` (and any other app schemas).
- [ ] List all views, materialized views.
- [ ] List all functions / RPCs (especially `match_conversation_messages`).
- [ ] List all extensions (`vector` / `pgvector`, etc.) and versions.
- [ ] List all enums / custom types.
- [ ] Capture whether RLS is enabled per table (even if policies are empty).

### Suggested discovery SQL (run in Supabase SQL editor)

```sql
-- Tables
select table_schema, table_name
from information_schema.tables
where table_schema in ('public')
  and table_type = 'BASE TABLE'
order by 1, 2;

-- Columns
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- Extensions
select extname, extversion from pg_extension order by 1;

-- Functions in public
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by 1;

-- RLS flags
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;
```

---

## B. Tables the application currently references

Verify each exists and record **exact** column names, types, nullability, defaults, and FKs.

| Table | Expected by app (hint only) | Verified? | Notes / diffs |
|-------|-----------------------------|-----------|---------------|
| `conversations` | `user_id`, `title`, `assistant_mode`, `active_branch_id`, memory + model fields, timestamps | [ ] | |
| `conversation_branches` | `conversation_id`, `user_id`, `title`, `branch_order`, timestamps | [ ] | |
| `messages` | `conversation_id`, `user_id`, `branch_id`, `role`, `content`, embedding columns, `created_at` | [ ] | |
| `conversation_memory_items` | memory fields + `source_message_ids`, timestamps | [ ] | |
| `user_ai_credits` | plan / trial / monthly / access_mode fields (see `lib/assistant/userCredits.ts`) | [ ] | |
| `subscription_plans` | `code`, pricing, `monthly_token_limit`, `allowed_model_tier`, `is_active`, `sort_order` | [ ] | |
| `user_subscription_payments` | payment insert fields from mock-upgrade route | [ ] | |

Also record **any extra tables** present in the DB but unused by the app:

| Extra table | Keep in baseline? | Notes |
|-------------|-------------------|-------|
| | | |

---

## C. Embeddings / vector

- [ ] Confirm extension name and schema (`vector` in `extensions` vs `public`).
- [ ] Confirm `messages.embedding` type and dimensions (app default **1536**).
- [ ] Confirm supporting columns: `embedding_model`, `embedding_dimensions`, `embedding_content_hash`, `embedded_at`.
- [ ] Confirm indexes on embedding column (ivfflat / hnsw / none).

---

## D. RPC: `match_conversation_messages`

- [ ] Function exists.
- [ ] Exact argument names and types match the app call in `lib/assistant/semanticMemory.ts`:
  - `query_embedding`
  - `target_conversation_id`
  - `target_user_id`
  - `match_threshold`
  - `match_count`
- [ ] Exact return columns documented (app expects at least `id`, `content`, similarity-like field).
- [ ] `SECURITY DEFINER` / `INVOKER` and RLS interaction recorded.
- [ ] Full `pg_get_functiondef` saved for P0-A2 baseline.

---

## E. Auth and privileges

- [ ] Confirm app uses Supabase Auth (`auth.users`); no separate public `users` table required by app.
- [ ] Document grants for `anon` / `authenticated` / `service_role` on each table.
- [ ] Confirm service role is only used where intended (`lib/supabase/admin.ts`).

---

## F. Storage / Edge (record absence or presence)

- [ ] Storage buckets (app currently does not use Storage in code).
- [ ] Edge functions (none in this repo).

---

## G. Dump artifacts for P0-A2 (do not invent)

Produce and store securely (or attach to the P0-A2 PR):

- [ ] Schema-only dump or `supabase db pull` output reviewed by a human.
- [ ] Diff: dump vs “tables hinted by app” (section B) — no silent omissions.
- [ ] Decision: baseline migration content = **dump**, not hand-inferred SQL.

---

## Sign-off (required before P0-A2)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineer who ran discovery | | | |
| Reviewer | | | |

**P0-A2 may start only when sections A–G are complete and sign-off is filled.**
