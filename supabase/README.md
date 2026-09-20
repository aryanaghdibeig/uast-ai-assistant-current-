# Supabase migrations (UAST AI Platform)

## Phase status

| Phase | Scope | Status |
|-------|--------|--------|
| **P0-A1** | CLI config, folder layout, discovery checklist, typegen workflow | **This PR** |
| **P0-A2** | Baseline migration SQL after live schema verification | Not started |

Do **not** add inferred production DDL here until P0-A2 is approved and the [schema verification checklist](./SCHEMA_VERIFICATION.md) is complete.

## Prerequisites

1. Install [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Link to the hosted project (never commit access tokens):

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

3. Ensure `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and keys as documented in `.env.example`.

## Useful commands

| Command | Purpose |
|---------|---------|
| `npm run db:link` | Print link instructions (wrapper) |
| `npm run db:pull` | Pull remote schema into a new migration (use only when ready for P0-A2) |
| `npm run db:types` | Generate `types/database.generated.ts` from the linked remote DB |
| `npm run db:types:local` | Generate types from local Supabase (if `supabase start` is used) |

## Rules

1. **Existing production data is sacred.** Never `CREATE`/`DROP` objects that already exist in prod via a “baseline” that redefines them. On an existing project, mark the verified baseline as already applied (`supabase migration repair`) after P0-A2.
2. **No hand-written `types/database.ts`.** Types come only from `db:types` / `db:types:local`.
3. **Application code is out of scope for P0-A1/A2.** Do not change `app/` or `lib/` while only establishing schema tooling.
4. Generated dumps and temporary SQL under `supabase/.temp/` stay gitignored.

## Next step (P0-A2)

1. Complete every item in `SCHEMA_VERIFICATION.md`.
2. Dump or `db pull` the live schema.
3. Commit a single baseline migration that matches the verified dump.
4. Run `npm run db:types` and commit `types/database.generated.ts` only after verification.
