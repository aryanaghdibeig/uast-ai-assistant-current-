# Database type generation workflow

Types for Supabase must be **generated**, never hand-authored as a parallel schema.

## Output file

| File | Committed? | When |
|------|------------|------|
| `types/database.generated.ts` | Yes, after P0-A2 verification | Created by `npm run db:types` |
| `types/database.ts` | **Do not create by hand** | Not used |

Until P0-A2, `types/database.generated.ts` may be absent. That is expected.

## Commands

From the repo root (Supabase CLI required):

```bash
# Against the linked remote project (preferred for shared types)
npm run db:types

# Against local supabase start
npm run db:types:local
```

These scripts write:

`types/database.generated.ts`

## Linking

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

Project ref is the subdomain id in `https://<ref>.supabase.co`.

## CI note (future)

A later phase can fail CI if `db:types` output differs from the committed file. Not part of P0-A1.
