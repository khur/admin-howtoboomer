# Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A private Vite/React admin site at `apps/admin` where the owner can see signups, tool usage (web vs. iOS), browse/search users, edit a profile, send a password reset, and delete a user.

**Architecture:** Static SPA talking directly to the existing Supabase project. Cross-user reads are gated by a `profiles.is_admin` flag via `is_admin()` (SECURITY DEFINER) used in new RLS policies and four admin RPCs. The one privileged write (delete another user) goes through an `admin-users` edge function that re-checks the flag with the service role.

**Tech Stack:** Vite 7, React 19, TypeScript 5.9, Tailwind v4 (`@tailwindcss/vite`), react-router v7, TanStack Query v5, `@supabase/supabase-js` v2, Recharts 3, Vitest 4 + Testing Library.

**Spec:** `apps/admin/docs/superpowers/specs/2026-09-10-admin-portal-design.md`

## Global Constraints

- Supabase project: `hdzwddjeovtppihzwbfv` (Postgres 17). Same project web/mobile use.
- `auth.users` has rows without a `profiles` row (12 vs 8 today) — always LEFT JOIN from `auth.users`.
- Every admin RPC starts with `if not public.is_admin() then raise exception 'not authorized'; end if;`.
- Design: editorial tokens from `apps/web/src/styles/global.css` — `--border-strong` for every component edge, DM Sans display / Nunito body, square corners, 48px min hit targets.
- Every successful mutation shows a success toast (project rule).
- `apps/admin` is its own git repo (parent folder is not a repo). Commit after each task.

---

### Task 1: Scaffold `apps/admin`

**Files:**
- Create: `apps/admin/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/styles/global.css`, `.env.example`, `.gitignore`, `README.md`, `vitest.config.ts`, `src/test/setup.ts`

- [ ] **Step 1: Init**

```bash
cd apps/admin && git init -b main
npm init -y
npm i react react-dom react-router @tanstack/react-query @supabase/supabase-js recharts lucide-react
npm i -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Config files**

`vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({ plugins: [react(), tailwindcss()] });
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: true },
});
```

`src/test/setup.ts`: `import "@testing-library/jest-dom/vitest";`

`tsconfig.json`: strict, `jsx: react-jsx`, `moduleResolution: bundler`, `types: ["vite/client", "vitest/globals"]`, `paths: {"@/*": ["./src/*"]}` (add `resolve.alias` in both vite configs).

`package.json` scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (`vitest run`), `lint` skipped (no eslint in v1).

`index.html`: Google Fonts link identical to web's BaseLayout (`DM+Sans:wght@400;500;600;700&family=Nunito:ital,wght@0,400..800;1,400..700`), `<div id="root">`, title "Ht,B Admin".

`src/styles/global.css`: `@import "tailwindcss";` then the `:root` token block from web (brand, ink, surfaces, hairline, `--border-strong`, `--font-*`), `@theme inline` mapping `--color-canvas`, `--color-surface`, `--color-surface-soft`, `--color-ink`, `--color-body`, `--color-muted`, `--color-edge` (→ `--border-strong`), `--color-hairline`, `--color-brick`, `--color-brick-active`, `--color-on-brick`, `--color-teal`, `--color-marigold`, `--font-display`, `--font-body`; base: `body { background: var(--canvas); color: var(--ink); font-family: var(--font-body) }`, `h1,h2,h3 { font-family: var(--font-display) }`, `:focus-visible { outline: 2px solid var(--rausch); outline-offset: 2px }`.

`.env.example`: `VITE_SUPABASE_URL=` / `VITE_SUPABASE_ANON_KEY=`. Copy real values from `apps/web/.env` into `apps/admin/.env`.

- [ ] **Step 3: `src/main.tsx` renders `<h1>Ht,B Admin</h1>`; `npm run dev` shows it; `npm run build` passes**

- [ ] **Step 4: Commit** `chore: scaffold admin portal (vite + react + tailwind)`

---

### Task 2: Supabase migration — admin flag, policies, RPCs

**Files:**
- Create: `apps/admin/supabase/migrations/20260910000000_admin_portal.sql`

**Interfaces produced (used by Task 4 `api.ts`):**
- `is_admin() returns boolean`
- `admin_stats() returns jsonb` — shape per spec
- `admin_users(search text, lim int, off int) returns table(user_id uuid, email text, full_name text, username text, avatar_url text, created_at timestamptz, last_sign_in_at timestamptz, run_count bigint, is_admin boolean, total_count bigint)`
- `admin_user_detail(p_user_id uuid) returns jsonb` — `{ user, activity }`
- `admin_activity(p_feature text, p_platform text, p_since timestamptz, lim int, off int) returns table(id uuid, created_at timestamptz, user_id uuid, email text, feature_type text, platform text, input_text text, output_json jsonb, total_count bigint)`

- [ ] **Step 1: Write the migration**

```sql
-- Admin portal: one flag on profiles, is_admin() helper, admin RLS, admin RPCs.

alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- Users manage their own profile row; stop them flipping is_admin on themselves.
create or replace function public.profiles_guard_is_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if current_setting('role', true) = 'service_role' then return new; end if;
  if tg_op = 'INSERT' and new.is_admin then
    if not public.is_admin() then raise exception 'not authorized to set is_admin'; end if;
  elsif tg_op = 'UPDATE' and new.is_admin is distinct from old.is_admin then
    if not public.is_admin() then raise exception 'not authorized to change is_admin'; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_is_admin on public.profiles;
create trigger profiles_guard_is_admin before insert or update on public.profiles
  for each row execute function public.profiles_guard_is_admin();

-- Admin RLS
drop policy if exists admin_select_all on public.profiles;
create policy admin_select_all on public.profiles for select to authenticated using (public.is_admin());
drop policy if exists admin_update_all on public.profiles;
create policy admin_update_all on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists admin_select_all on public.user_activity_history;
create policy admin_select_all on public.user_activity_history for select to authenticated using (public.is_admin());

create index if not exists user_activity_history_created_at_idx on public.user_activity_history (created_at desc);
create index if not exists user_activity_history_user_created_idx on public.user_activity_history (user_id, created_at desc);

-- Stats
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'active_users_7d', (select count(distinct user_id) from user_activity_history where created_at >= now() - interval '7 days'),
    'active_users_30d', (select count(distinct user_id) from user_activity_history where created_at >= now() - interval '30 days'),
    'runs_7d', (select count(*) from user_activity_history where created_at >= now() - interval '7 days'),
    'runs_30d', (select count(*) from user_activity_history where created_at >= now() - interval '30 days'),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(c.n, 0)) order by d.day), '[]'::jsonb)
      from generate_series((now() - interval '29 days')::date, now()::date, '1 day') d(day)
      left join (select created_at::date day, count(*) n from auth.users where created_at >= (now() - interval '29 days')::date group by 1) c using (day)),
    'runs_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'platform', platform, 'count', n) order by day, platform), '[]'::jsonb)
      from (select created_at::date day, coalesce(metadata->>'platform', 'unknown') platform, count(*) n
            from user_activity_history where created_at >= (now() - interval '29 days')::date group by 1, 2) x),
    'runs_by_tool', (
      select coalesce(jsonb_agg(jsonb_build_object('feature_type', feature_type, 'count', n) order by n desc), '[]'::jsonb)
      from (select feature_type::text, count(*) n from user_activity_history group by 1) x)
  ) into r;
  return r;
end $$;

-- Users list
create or replace function public.admin_users(search text default null, lim int default 50, off int default 0)
returns table(user_id uuid, email text, full_name text, username text, avatar_url text,
              created_at timestamptz, last_sign_in_at timestamptz, run_count bigint, is_admin boolean, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select u.id, u.email::text, p.full_name, p.username, p.avatar_url, u.created_at, u.last_sign_in_at,
           coalesce(a.n, 0), coalesce(p.is_admin, false), count(*) over ()
    from auth.users u
    left join profiles p on p.user_id = u.id
    left join (select h.user_id, count(*) n from user_activity_history h group by 1) a on a.user_id = u.id
    where search is null or search = '' or u.email ilike '%' || search || '%' or p.full_name ilike '%' || search || '%'
    order by u.created_at desc
    limit lim offset off;
end $$;

-- One user + their activity
create or replace function public.admin_user_detail(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'user', (select to_jsonb(x) from (
      select u.id user_id, u.email, p.full_name, p.username, p.avatar_url, u.created_at, u.last_sign_in_at,
             (select count(*) from user_activity_history h where h.user_id = u.id) run_count, coalesce(p.is_admin, false) is_admin
      from auth.users u left join profiles p on p.user_id = u.id where u.id = p_user_id) x),
    'activity', (select coalesce(jsonb_agg(to_jsonb(y) order by y.created_at desc), '[]'::jsonb) from (
      select h.id, h.created_at, h.feature_type::text, coalesce(h.metadata->>'platform', 'unknown') platform,
             h.input_text, h.output_json, h.metadata
      from user_activity_history h where h.user_id = p_user_id order by h.created_at desc limit 500) y)
  ) into r;
  return r;
end $$;

-- Global activity feed
create or replace function public.admin_activity(p_feature text default null, p_platform text default null,
                                                 p_since timestamptz default null, lim int default 100, off int default 0)
returns table(id uuid, created_at timestamptz, user_id uuid, email text, feature_type text, platform text,
              input_text text, output_json jsonb, total_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select h.id, h.created_at, h.user_id, u.email::text, h.feature_type::text,
           coalesce(h.metadata->>'platform', 'unknown'), h.input_text, h.output_json, count(*) over ()
    from user_activity_history h
    left join auth.users u on u.id = h.user_id
    where (p_feature is null or h.feature_type::text = p_feature)
      and (p_platform is null or coalesce(h.metadata->>'platform', 'unknown') = p_platform)
      and (p_since is null or h.created_at >= p_since)
    order by h.created_at desc
    limit lim offset off;
end $$;

revoke all on function public.admin_stats() from public;
revoke all on function public.admin_users(text, int, int) from public;
revoke all on function public.admin_user_detail(uuid) from public;
revoke all on function public.admin_activity(text, text, timestamptz, int, int) from public;
grant execute on function public.admin_stats() to authenticated;
grant execute on function public.admin_users(text, int, int) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_activity(text, text, timestamptz, int, int) to authenticated;
```

- [ ] **Step 2: Apply via MCP `apply_migration` (name `admin_portal`)**
- [ ] **Step 3: Promote owner**: `update public.profiles set is_admin = true where user_id = (select id from auth.users where email = '<owner email>')` via `execute_sql` (service role bypasses the trigger). If the owner has no profiles row, insert one first.
- [ ] **Step 4: Smoke test** via `execute_sql`: `set role authenticated; set request.jwt.claims = '{"sub":"<owner id>","role":"authenticated"}'; select admin_stats();` — expect json. Repeat with a non-admin sub → expect `not authorized`.
- [ ] **Step 5: Commit** `feat(db): admin flag, policies and RPCs`

---

### Task 3: Edge function `admin-users`

**Files:**
- Create: `apps/admin/supabase/functions/admin-users/index.ts`, `deno.json` (copy from `apps/web/supabase/functions/delete-account/deno.json` if present, else `{}`)

**Interfaces produced:** `POST /functions/v1/admin-users` body `{ action: "delete", userId: string }` → `200 { success: true }` | `4xx/5xx { error: string }`.

- [ ] **Step 1: Write function** — structure copied from `delete-account/index.ts`: CORS, `getUser(jwt)` → caller; then `admin.from("profiles").select("is_admin").eq("user_id", caller.id).maybeSingle()` → 403 unless `is_admin === true`; parse body; 400 unless `action === "delete"` and `userId` is a uuid; 400 if `userId === caller.id` ("Use in-app account deletion for your own account."); then delete `user_activity_history` → `profiles` → avatars (best-effort) → `auth.admin.deleteUser(userId)`.
- [ ] **Step 2: Deploy via MCP `deploy_edge_function` (`verify_jwt: true`)**
- [ ] **Step 3: Commit** `feat(functions): admin-users delete action`

---

### Task 4: Supabase client, `format.ts`, `api.ts` (TDD)

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/format.ts`, `src/lib/format.test.ts`, `src/lib/api.ts`, `src/lib/api.test.ts`, `src/lib/types.ts`

**Interfaces produced:**
```ts
// types.ts
export type Platform = "web" | "ios" | "android" | "unknown";
export type FeatureType = "shame_detector" | "tone_breakdown" | "tone_adjuster" | "translator" | "generate_response";
export interface Stats { total_users: number; new_users_7d: number; new_users_30d: number; active_users_7d: number; active_users_30d: number; runs_7d: number; runs_30d: number; signups_by_day: {day: string; count: number}[]; runs_by_day: {day: string; platform: string; count: number}[]; runs_by_tool: {feature_type: string; count: number}[] }
export interface AdminUser { user_id: string; email: string; full_name: string | null; username: string | null; avatar_url: string | null; created_at: string; last_sign_in_at: string | null; run_count: number; is_admin: boolean }
export interface ActivityRow { id: string; created_at: string; feature_type: string; platform: string; input_text: string; output_json: unknown; metadata?: unknown; user_id?: string; email?: string | null }
export interface Page<T> { rows: T[]; total: number }
// format.ts
export function formatDate(iso: string | null | undefined): string   // "Sep 10, 2026" or "—"
export function formatRelative(iso: string | null | undefined, now?: Date): string // "3h ago", "2d ago", "never"
export function featureLabel(ft: string): string  // same table as mobile activity.ts
export function preview(text: string, max?: number): string // truncate with "…", default 80
// api.ts
export function getStats(): Promise<Stats>
export function listUsers(search: string, page: number, pageSize?: number): Promise<Page<AdminUser>>
export function getUserDetail(userId: string): Promise<{ user: AdminUser; activity: ActivityRow[] }>
export function listActivity(f: { feature?: string; platform?: string; since?: string; page: number; pageSize?: number }): Promise<Page<ActivityRow>>
export function updateProfile(userId: string, patch: { full_name?: string; username?: string }): Promise<void>
export function sendPasswordReset(email: string): Promise<void>
export function deleteUser(userId: string): Promise<void>   // invokes edge fn "admin-users"
export function checkIsAdmin(): Promise<boolean>            // rpc("is_admin")
```

- [ ] **Step 1: `format.test.ts`** — formatDate null → "—"; formatRelative 3h → "3h ago", null → "never"; featureLabel unknown passthrough; preview truncates at 80 with "…".
- [ ] **Step 2: Run, fail. Implement `format.ts`. Run, pass.**
- [ ] **Step 3: `api.test.ts`** — `vi.mock("./supabase")` with a fake `{ rpc, from, auth, functions }`. Assert: `listUsers("bob", 2)` calls `rpc("admin_users", { search: "bob", lim: 50, off: 50 })` and returns `{ rows, total: rows[0].total_count }` (total 0 for empty); `deleteUser("x")` calls `functions.invoke("admin-users", { body: { action: "delete", userId: "x" } })` and throws on `{ error }`; `updateProfile` calls `from("profiles").update(patch).eq("user_id", id)`; `checkIsAdmin` returns `data === true`.
- [ ] **Step 4: Run, fail. Implement `api.ts` + `supabase.ts` (`createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`). Run, pass.**
- [ ] **Step 5: Commit** `feat: typed api layer + formatters`

---

### Task 5: Auth — provider, login page, `RequireAdmin` guard

**Files:**
- Create: `src/auth/AuthProvider.tsx`, `src/auth/RequireAdmin.tsx`, `src/auth/RequireAdmin.test.tsx`, `src/pages/Login.tsx`

**Interfaces produced:**
```ts
export interface AuthState { session: Session | null; isAdmin: boolean | null; loading: boolean; signIn(email, password): Promise<void>; signOut(): Promise<void> }
export function useAuth(): AuthState
export function AuthProvider({ children })
export function RequireAdmin({ children })  // loading → spinner; no session → <Navigate to="/login">; isAdmin false → NotAuthorized screen w/ sign-out; true → children
```

- [ ] **Step 1: `RequireAdmin.test.tsx`** — mock `useAuth` for the four states; assert child rendered only when `isAdmin === true`, "Not authorized" text when false, redirect (MemoryRouter + a `/login` route) when no session.
- [ ] **Step 2: Fail → implement `AuthProvider` (`getSession` + `onAuthStateChange`; after session set, `checkIsAdmin()` → `isAdmin`) and `RequireAdmin` → pass.**
- [ ] **Step 3: `Login.tsx`** — centered card (`border border-edge bg-surface`), email + password inputs (48px tall), brick pill submit, inline error. On success `navigate("/")`.
- [ ] **Step 4: Commit** `feat: auth provider, login, admin guard`

---

### Task 6: Shell, shared components, router

**Files:**
- Create: `src/components/Shell.tsx`, `StatTile.tsx`, `DataTable.tsx`, `Pagination.tsx`, `ConfirmDialog.tsx`, `Toast.tsx` (+ `useToast`), `ErrorBlock.tsx`, `Spinner.tsx`; modify `src/main.tsx`

- [ ] **Step 1: Shell** — left sidebar (240px, `bg-surface border-r border-edge`): wordmark "How to, Boomer! · Admin", nav links Dashboard / Users / Activity (lucide icons, `aria-current`), signed-in email + Sign out at bottom. Main area `p-8 max-w-6xl`. Collapses to top bar under 768px.
- [ ] **Step 2: StatTile** — `label`, `value`, optional `hint`. DataTable — generic `columns: {key, header, render, className}[]`, `rows`, `onRowClick`, `emptyText`. Pagination — `page`, `total`, `pageSize`, `onChange`. ConfirmDialog — native `<dialog>`, `title`, `body`, `confirmText` (the string the user must type), `onConfirm`. Toast — context + `useToast().show({ kind: 'success'|'error', text })`, auto-dismiss 4s, `role="status"`. ErrorBlock — message + Retry.
- [ ] **Step 3: `main.tsx`** — `QueryClientProvider` → `AuthProvider` → `ToastProvider` → `BrowserRouter` → routes: `/login`; `RequireAdmin` + `Shell` wrapping `/`, `/users`, `/users/:id`, `/activity` (placeholder pages).
- [ ] **Step 4: `npm run build` passes; commit** `feat: app shell and shared components`

---

### Task 7: Dashboard page

**Files:**
- Create: `src/pages/Dashboard.tsx`, `src/components/charts/SignupsChart.tsx`, `RunsByDayChart.tsx`, `RunsByToolChart.tsx`, `src/lib/chart-data.ts`, `src/lib/chart-data.test.ts`

- [ ] **Step 1: `chart-data.test.ts`** — `pivotRunsByDay(rows)` turns `[{day, platform, count}]` into `[{day, web, ios, unknown}]` with missing platforms as 0 and days sorted; `platformKeys(rows)` returns distinct platforms sorted with `unknown` last.
- [ ] **Step 2: Fail → implement → pass.**
- [ ] **Step 3: Dashboard** — `useQuery(["stats"], getStats)`; 6 StatTiles in a responsive grid; three cards each with an `h2` and a Recharts `ResponsiveContainer` (height 260): SignupsChart (BarChart, brick), RunsByDayChart (stacked bars, colors per platform: web `--teal`, ios `--rausch`, unknown `--ink-muted`), RunsByToolChart (horizontal BarChart, labels via `featureLabel`). Empty → "No data yet."
- [ ] **Step 4: Verify in browser; commit** `feat: dashboard`

---

### Task 8: Users list + User detail

**Files:**
- Create: `src/pages/Users.tsx`, `src/pages/UserDetail.tsx`, `src/components/ActivityList.tsx`, `src/lib/use-debounce.ts`

- [ ] **Step 1: Users** — search input (debounced 300ms, `use-debounce.ts`), `useQuery(["users", search, page], …)`, DataTable columns: Email, Name, Joined (`formatDate`), Last sign-in (`formatRelative`), Runs; row click → `/users/:id`; Pagination.
- [ ] **Step 2: ActivityList** — rows: time, tool label, platform badge, input preview; click toggles an expanded panel with full `input_text` and `<pre>` of `JSON.stringify(output_json, null, 2)`. Reused by Activity page.
- [ ] **Step 3: UserDetail** — `useQuery(["user", id], …)`. Header: email, admin badge, joined, last sign-in, run count. Profile form: full name + username, Save → `updateProfile` mutation → invalidate `["user", id]` → success toast. Actions card: "Send password reset" → `sendPasswordReset(email)` → toast; "Delete user" → ConfirmDialog (must type the email) → `deleteUser` → toast → `navigate("/users")`. Delete button disabled with hint when `user.user_id === session.user.id`.
- [ ] **Step 4: Verify in browser (edit a name, send reset to yourself); commit** `feat: users list and detail`

---

### Task 9: Activity page

**Files:**
- Create: `src/pages/Activity.tsx`

- [ ] **Step 1** — filter row: tool `<select>` (all + 5 features), platform `<select>` (all/web/ios/unknown), since `<input type="date">`. Filters live in URL search params. `useQuery(["activity", filters, page], …)`. ActivityList with an extra email column linking to `/users/:id`. Pagination.
- [ ] **Step 2: Verify; commit** `feat: activity feed`

---

### Task 10: Platform tag in web + mobile loggers

**Files:**
- Modify: `apps/web/src/data/supabase/activity-logger.ts:29-34`
- Modify: `apps/mobile/src/lib/activity.ts:45-50`

- [ ] **Step 1: web** — `meta: { platform: "web", ...metadata }`. Run `npm test` in `apps/web`.
- [ ] **Step 2: mobile** — `import { Platform } from "react-native"`; `meta: { platform: Platform.OS, ...metadata }`. Run `npm test` in `apps/mobile`.
- [ ] **Step 3: Commit each repo** `feat: tag activity rows with platform`. Do not deploy/publish — that rides the next release.

---

### Task 11: Deploy notes + memory

- [ ] **Step 1: README** — env vars, `npm run dev`, Cloudflare Pages settings (build `npm run build`, output `dist`, SPA fallback: add `public/_redirects` with `/* /index.html 200`), how to promote another admin (one SQL line).
- [ ] **Step 2: GitHub repo** — user creates `how-to-boomer-admin` (or I do via `gh repo create` if asked) and connects Cloudflare Pages.
- [ ] **Step 3: Memory** — add `admin-portal.md` (status, project id, how admin is granted, pending: Cloudflare hookup).

## Self-review
- Spec coverage: auth model (T2, T5), migration (T2), edge fn (T3), platform tag (T10), pages (T7–T9), error/toast rules (T6), testing (T4, T5, T7). Deploy (T11). ✔
- Types: `AdminUser.user_id` is the key everywhere (RPC column `user_id`, detail json `user_id`). `Page<T>` from `api.ts` consumed by T8/T9. ✔
