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

## Deploy (Cloudflare Pages)

- Build command: `npm run build` · output: `dist`
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `public/_redirects` already routes every path to `index.html` (SPA).
- `index.html` carries `noindex, nofollow`.
