-- Free-tier daily limits: admin-editable global numbers + per-user override.
-- See apps/web/docs/superpowers/specs/2026-09-19-free-tier-daily-limits-design.md
--
-- Anonymous callers (no JWT user) are counted per IP against anon_daily_limit;
-- signed-in callers per user id against coalesce(profiles.daily_run_limit,
-- user_daily_limit). The per-minute and global caps are unchanged in shape,
-- just read from app_settings instead of being hard-coded.

-- Settings: one row, typed columns --------------------------------------------
create table if not exists public.app_settings (
  id boolean primary key default true check (id),
  anon_daily_limit int not null default 7 check (anon_daily_limit >= 0),
  user_daily_limit int not null default 100 check (user_daily_limit >= 0),
  ip_minute_limit int not null default 8 check (ip_minute_limit >= 0),
  global_daily_limit int not null default 500 check (global_daily_limit >= 0),
  updated_at timestamptz not null default now()
);
comment on table public.app_settings is 'Single-row site settings (id is always true). Edited from the admin portal.';
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

alter table public.app_settings enable row level security;
drop policy if exists "admins read settings" on public.app_settings;
create policy "admins read settings" on public.app_settings
  for select to authenticated using ((select public.is_admin()));
drop policy if exists "admins update settings" on public.app_settings;
create policy "admins update settings" on public.app_settings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.app_settings_touch() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists app_settings_touch on public.app_settings;
create trigger app_settings_touch before update on public.app_settings
  for each row execute function public.app_settings_touch();

-- Per-user override -------------------------------------------------------------
alter table public.profiles add column if not exists daily_run_limit int
  check (daily_run_limit is null or daily_run_limit >= 0);
comment on column public.profiles.daily_run_limit is 'Per-user daily AI run cap. null = app_settings.user_daily_limit. 0 = blocked.';

-- Users may update their own profile row; only admins may touch the limit.
create or replace function public.profiles_guard_daily_run_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Direct SQL and the service role have no JWT user; only end-user sessions are checked.
  if (select auth.uid()) is null then return new; end if;
  if tg_op = 'INSERT' and new.daily_run_limit is not null then
    if not public.is_admin() then raise exception 'not authorized to set daily_run_limit'; end if;
  elsif tg_op = 'UPDATE' and new.daily_run_limit is distinct from old.daily_run_limit then
    if not public.is_admin() then raise exception 'not authorized to change daily_run_limit'; end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard_daily_run_limit on public.profiles;
create trigger profiles_guard_daily_run_limit before insert or update on public.profiles
  for each row execute function public.profiles_guard_daily_run_limit();

-- Rate limiter ------------------------------------------------------------------
drop function if exists public.check_and_increment_rate_limits(text);

create or replace function public.check_and_increment_rate_limits(p_ip text, p_user_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = 'public' as $$
declare
  s record;
  v_min_count int;
  v_day_count int;
  v_global_count int;
  v_day_key text;
  v_day_limit int;
  v_day_verdict text;
  v_verdict text := 'ok';
begin
  select anon_daily_limit, user_daily_limit, ip_minute_limit, global_daily_limit
    into s from app_settings where id = true;
  if not found then
    select 7 as anon_daily_limit, 100 as user_daily_limit, 8 as ip_minute_limit, 500 as global_daily_limit into s;
  end if;

  if p_user_id is null then
    v_day_key := 'ip:' || p_ip || ':day';
    v_day_limit := s.anon_daily_limit;
    v_day_verdict := 'anon_day';
  else
    v_day_key := 'user:' || p_user_id::text || ':day';
    v_day_limit := coalesce(
      (select p.daily_run_limit from profiles p where p.user_id = p_user_id),
      s.user_daily_limit);
    v_day_verdict := 'user_day';
  end if;

  -- Opportunistic cleanup; table stays tiny, full scan is fine.
  delete from edge_rate_limits where window_start < now() - interval '2 days';

  insert into edge_rate_limits as r (key, window_start, count)
  values ('ip:' || p_ip || ':min', date_trunc('minute', now()), 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning count into v_min_count;

  insert into edge_rate_limits as r (key, window_start, count)
  values (v_day_key, date_trunc('day', now()), 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning count into v_day_count;

  insert into edge_rate_limits as r (key, window_start, count)
  values ('global:day', date_trunc('day', now()), 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning count into v_global_count;

  if v_min_count > s.ip_minute_limit then v_verdict := 'ip_minute';
  elsif v_day_count > v_day_limit then v_verdict := v_day_verdict;
  elsif v_global_count > s.global_daily_limit then v_verdict := 'global_day';
  end if;

  return jsonb_build_object('verdict', v_verdict, 'limit', v_day_limit, 'used', v_day_count);
end $$;

revoke all on function public.check_and_increment_rate_limits(text, uuid) from public;
grant execute on function public.check_and_increment_rate_limits(text, uuid) to service_role;

-- Admin RPCs expose the override ---------------------------------------------------
drop function if exists public.admin_users(text, int, int, text, text);
create or replace function public.admin_users(
  search text default null, lim int default 50, off int default 0,
  sort_by text default 'created_at', sort_dir text default 'desc')
returns table(user_id uuid, email text, full_name text, username text, avatar_url text,
              created_at timestamptz, last_sign_in_at timestamptz, run_count bigint,
              tool_runs bigint, last_run_at timestamptz, is_admin boolean,
              daily_run_limit int, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  col text;
  dir text := case when lower(sort_dir) = 'asc' then 'asc' else 'desc' end;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  col := case sort_by
    when 'email' then 'u.email'
    when 'full_name' then 'p.full_name'
    when 'last_sign_in_at' then 'u.last_sign_in_at'
    when 'run_count' then 'coalesce(a.n, 0)'
    when 'tool_runs' then 'coalesce(t.n, 0)'
    when 'last_run_at' then 't.last_at'
    else 'u.created_at'
  end;
  return query execute format($q$
    select u.id, u.email::text, p.full_name, p.username, p.avatar_url, u.created_at, u.last_sign_in_at,
           coalesce(a.n, 0)::bigint, coalesce(t.n, 0)::bigint, t.last_at, coalesce(p.is_admin, false),
           p.daily_run_limit, count(*) over ()
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join (select h.user_id, count(*) n from public.user_activity_history h group by 1) a on a.user_id = u.id
    left join (select r.user_id, count(*) n, max(r.created_at) last_at from public.tool_runs r where r.status = 'ok' group by 1) t on t.user_id = u.id
    where $1 is null or $1 = ''
       or u.email ilike '%%' || $1 || '%%'
       or p.full_name ilike '%%' || $1 || '%%'
    order by %s %s nulls last, u.created_at desc
    limit $2 offset $3
  $q$, col, dir) using search, lim, off;
end $$;
revoke all on function public.admin_users(text, int, int, text, text) from public;
grant execute on function public.admin_users(text, int, int, text, text) to authenticated;

create or replace function public.admin_user_detail(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'user', (select to_jsonb(x) from (
      select u.id user_id, u.email, p.full_name, p.username, p.avatar_url, u.created_at, u.last_sign_in_at,
             (select count(*) from public.user_activity_history h where h.user_id = u.id) run_count,
             (select count(*) from public.tool_runs t where t.user_id = u.id and t.status = 'ok') tool_runs,
             (select max(t.created_at) from public.tool_runs t where t.user_id = u.id) last_run_at,
             coalesce(p.is_admin, false) is_admin,
             p.daily_run_limit
      from auth.users u left join public.profiles p on p.user_id = u.id
      where u.id = p_user_id) x),
    'activity', (select coalesce(jsonb_agg(to_jsonb(y) order by y.created_at desc), '[]'::jsonb) from (
      select h.id, h.created_at, h.feature_type::text, coalesce(h.metadata->>'platform', 'unknown') platform,
             h.input_text, h.output_json, h.metadata
      from public.user_activity_history h
      where h.user_id = p_user_id order by h.created_at desc limit 500) y),
    'runs', (select coalesce(jsonb_agg(to_jsonb(z) order by z.created_at desc), '[]'::jsonb) from (
      select t.id, t.created_at, t.feature, t.platform, t.page, t.status, t.duration_ms
      from public.tool_runs t
      where t.user_id = p_user_id order by t.created_at desc limit 200) z)
  ) into r;
  return r;
end $$;
