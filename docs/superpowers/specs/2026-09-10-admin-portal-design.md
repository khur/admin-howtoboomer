# Admin Portal — Design

**Date:** 2026-09-10
**Status:** Approved (chat), building
**Repo:** `apps/admin` (new, own git repo like `apps/web` and `apps/mobile`)

## Purpose

A private web app for the owner to see who is using How to, Boomer! (web + iOS),
what they're doing, and to manage individual accounts. Read-mostly; the only
destructive action is deleting a user.

## Non-goals (v1)

- Ban/unban, bulk actions, exports, email campaigns, revenue/subscriptions.
- Multi-tenant roles. One flag (`profiles.is_admin`) is the whole permission model.
- Editing or deleting individual activity rows.

## Stack

- Vite + React 19 + TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), `react-router`
  (v7, data-less), TanStack Query v5, `@supabase/supabase-js` v2, Recharts.
- Vitest + Testing Library for unit tests.
- Design tokens copied from `apps/web/src/styles/global.css` (editorial theme:
  paper canvas, `--border-strong` load-bearing edges, DM Sans + Nunito via Google Fonts).
  Same "copy, don't share" approach the two existing apps use.
- Deploy: Cloudflare Pages via GitHub integration (static `dist/`). Env vars
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same project as web/mobile).

## Authorization model

- `profiles.is_admin boolean not null default false`.
- `public.is_admin()` — `SECURITY DEFINER`, `STABLE`, `search_path = public`:
  `select coalesce((select is_admin from profiles where user_id = auth.uid()), false)`.
  Definer so profiles' own RLS policy can call it without recursion.
- Trigger `profiles_guard_is_admin` (BEFORE INSERT OR UPDATE): raises unless
  `NEW.is_admin IS NOT DISTINCT FROM OLD.is_admin` (or `NEW.is_admin = false` on insert)
  or `is_admin()` is true. Prevents self-promotion through the existing
  "users manage their own row" policy. Service role bypasses RLS but not triggers,
  so the trigger checks `current_setting('role') = 'service_role'` and allows it.
- The owner is promoted once by direct SQL (`update profiles set is_admin = true where
  user_id = (select id from auth.users where email = '<owner>')`).
- Portal sign-in: normal Supabase email/password. After sign-in the client calls
  `rpc('is_admin')`; `false` renders a "Not authorized" screen with sign-out.
  This is UX only — every RPC and policy re-checks server-side.

## Supabase migration (`apps/admin/supabase/migrations/20260910000000_admin_portal.sql`)

Applied to prod through the Supabase MCP; the file is the record.

1. Column + function + trigger above.
2. RLS policies:
   - `profiles`: `admin_select_all` (SELECT, `is_admin()`), `admin_update_all` (UPDATE, `is_admin()`).
   - `user_activity_history`: `admin_select_all` (SELECT, `is_admin()`).
3. RPCs (all `SECURITY DEFINER`, `search_path = public`, first statement
   `if not is_admin() then raise exception 'not authorized' end if`; `REVOKE FROM public`,
   `GRANT EXECUTE TO authenticated`):
   - `admin_stats()` → jsonb:
     `{ total_users, new_users_7d, new_users_30d, active_users_7d, active_users_30d,
        runs_7d, runs_30d,
        signups_by_day: [{day, count}] (30d),
        runs_by_day: [{day, platform, count}] (30d; platform = metadata->>'platform', null → 'unknown'),
        runs_by_tool: [{feature_type, count}] (all time) }`.
     "Active" = has ≥1 activity row in window.
   - `admin_users(search text default null, lim int default 50, off int default 0)`
     → setof `(user_id, email, full_name, username, avatar_url, created_at,
     last_sign_in_at, run_count, is_admin, total_count)`. `search` matches
     `email ilike` or `full_name ilike`. Ordered by `created_at desc`.
     `total_count` is `count(*) over ()` for pagination.
   - `admin_user_detail(p_user_id uuid)` → jsonb:
     `{ user: {...same fields as admin_users row...},
        activity: [{id, created_at, feature_type, platform, input_text, output_json, metadata}] }`
     Activity ordered `created_at desc`, capped at 500.
   - `admin_activity(p_feature text default null, p_platform text default null,
     p_since timestamptz default null, lim int default 100, off int default 0)`
     → setof `(id, created_at, user_id, email, feature_type, platform, input_text,
     output_json, total_count)`.
4. Index: `user_activity_history (created_at desc)` and `(user_id, created_at desc)`
   if not already present.

## Edge function `admin-users` (`apps/admin/supabase/functions/admin-users/index.ts`)

`POST { action: 'delete', userId }` with the caller's JWT in `Authorization`.
1. `admin.auth.getUser(jwt)` → caller id; 401 if invalid.
2. `select is_admin from profiles where user_id = caller` via service client; 403 if not true.
3. Refuse if `userId === caller` (use the in-app delete for your own account).
4. Same deletion steps as `delete-account`: activity rows → profile row → avatars
   bucket (best-effort) → `auth.admin.deleteUser`.
Returns `{ success: true }` or `{ error }`.

Password reset needs no privilege: client calls `supabase.auth.resetPasswordForEmail(email)`
with no `redirectTo` (falls back to the project Site URL).
Profile edits go through the `admin_update_all` policy with a plain `update`.

## Platform tag (touches the other two repos)

- `apps/web/src/data/supabase/activity-logger.ts`: `meta: { platform: "web", ...metadata }`.
- `apps/mobile/src/lib/activity.ts`: `meta: { platform: Platform.OS, ...metadata }`.
Existing rows have no tag and show as "unknown".

## App structure

```
apps/admin/
  src/
    main.tsx                 router + QueryClient + AuthProvider
    styles/global.css        tokens + Tailwind
    lib/supabase.ts          client from env
    lib/format.ts            date/number helpers (tested)
    lib/api.ts               typed wrappers around the RPCs + edge function (tested w/ mocked client)
    auth/AuthProvider.tsx    session + isAdmin state
    auth/RequireAdmin.tsx    route guard
    components/              Shell (sidebar nav), StatTile, DataTable, Chart wrappers, ConfirmDialog
    pages/Login.tsx
    pages/Dashboard.tsx
    pages/Users.tsx
    pages/UserDetail.tsx
    pages/Activity.tsx
  supabase/migrations/…      the migration above
  supabase/functions/admin-users/index.ts
```

Routes: `/login`, `/` (dashboard), `/users`, `/users/:id`, `/activity`. Everything but
`/login` is wrapped in `RequireAdmin`.

## Pages

- **Dashboard** — 6 stat tiles (total users, new 7d, new 30d, active 7d, runs 7d, runs 30d);
  charts: signups/day (bar), runs/day stacked by platform (bar), runs by tool (horizontal bar).
- **Users** — search box (debounced), table (email, name, joined, last sign-in, runs),
  pagination 50/page, row → `/users/:id`.
- **User detail** — header (email, joined, last sign-in, admin badge); editable
  full name / username with Save; activity timeline with expandable input/output;
  Actions: *Send password reset* (toast on success), *Delete user* (dialog requires typing
  the email; disabled for self).
- **Activity** — filters (tool select, platform select, since date), table (time, user email
  → link, tool, platform, input preview), expandable output, pagination.

## Error handling

- Query errors render an inline error block with the message and a retry button.
- Mutations surface errors in a toast; success also toasts (this project's rule:
  confirm successful updates).
- 401/expired session → redirect to `/login`.

## Testing

- Vitest: `format.ts`, `api.ts` (mocked supabase client — verifies RPC names/params and
  edge function payload), `RequireAdmin` (renders child only when admin).
- Migration: applied to prod via MCP, then RPCs smoke-tested as the owner.
- Manual browser walkthrough of all four pages.
