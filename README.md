# How to, Boomer! — Admin

Private admin portal: signups, tool usage (web vs. iOS), user search, profile
edits, password resets, and user deletion. Vite + React + Tailwind v4 talking
directly to the shared Supabase project.

Design/spec: `docs/superpowers/specs/2026-09-10-admin-portal-design.md`.

## Run it

```bash
cp .env.example .env   # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (same project as web/mobile)
npm install
npm run dev            # http://localhost:3100
npm test
npm run build          # tsc + vite build → dist/
```

Sign in with a normal How to, Boomer! account. Only accounts with
`profiles.is_admin = true` get past the login screen — everyone else sees
"Not authorized".

## Who is an admin

One flag: `public.profiles.is_admin`. Promote someone with SQL in the Supabase
dashboard (the service role / dashboard bypasses the self-promotion guard):

```sql
update public.profiles set is_admin = true
where user_id = (select id from auth.users where email = 'person@example.com');
```

If they have no `profiles` row yet, insert one first:
`insert into public.profiles (user_id) values ('<uuid>')`.

## How access is enforced

Everything is checked server-side; the UI guard is cosmetic.

- `public.is_admin()` — SECURITY DEFINER lookup of the caller's flag.
- RLS: admins can `select` all `profiles` + `user_activity_history`, and `update` any profile.
- A trigger blocks non-admins from changing `is_admin` on their own row.
- RPCs (`admin_stats`, `admin_users`, `admin_user_detail`, `admin_activity`) all start
  with `if not is_admin() then raise`.
- Edge function `admin-users` (delete) re-checks the flag with the service key.

Migrations live in `supabase/migrations/` and were applied to prod through the
Supabase MCP; the files are the record.

## Two kinds of usage data

- **Runs** (`public.tool_runs`) — one row per AI call from either app, signed in or
  not, written by the `openai-handler` edge function (lives in `apps/web/supabase/functions`).
  Stores feature, platform, page path (web only), user id or a salted IP hash, status and
  latency. No prompt or completion text. This is the real usage number.
- **Saved results** (`public.user_activity_history`) — only what signed-in users chose to
  save with the Save button. Includes the text. Older and much smaller.

Rows with `source = 'backfill'` (Jun 13 – Sep 10 2026) were reconstructed from Supabase
edge-function logs before live logging existed: real timestamps (to the hour), platform,
user id, status and latency, but `feature = 'unknown'`, no page, and a differently-salted
visitor hash. Logs before Jun 23 carried no IP or user id, so those rows have neither.

Anonymous visitors are counted by `visitor_hash` = first 24 hex chars of
SHA-256(salt + ip). The salt is `TOOL_RUNS_SALT` if set as a function secret, otherwise
the service-role key.

## Deploy (Cloudflare Pages)

- Build command: `npm run build` · output: `dist`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `public/_redirects` already routes every path to `index.html` (SPA).
- `index.html` carries `noindex, nofollow`.



Date Trigger: 09/10/2026