-- Every AI tool call, signed-in or anonymous, logged by the openai-handler
-- edge function. No input/output text is stored; this is usage telemetry.
-- `user_activity_history` remains the user's *saved* results.

create table if not exists public.tool_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  feature text not null,
  platform text not null default 'unknown',
  page text,
  user_id uuid references auth.users(id) on delete set null,
  -- salted hash of the client IP so anonymous visitors can be counted, not identified
  visitor_hash text,
  status text not null default 'ok',   -- ok | error | rate_limited
  duration_ms integer
);
comment on table public.tool_runs is 'One row per AI tool call (web + mobile), written by openai-handler.';

alter table public.tool_runs enable row level security;
-- Only the service role writes; admins read.
revoke insert, update, delete on public.tool_runs from anon, authenticated;
drop policy if exists admin_select_all on public.tool_runs;
create policy admin_select_all on public.tool_runs
  for select to authenticated using ((select public.is_admin()));

create index if not exists tool_runs_created_at_idx on public.tool_runs (created_at desc);
create index if not exists tool_runs_user_created_idx on public.tool_runs (user_id, created_at desc);

-- Stats: runs now come from tool_runs; saved results keep their own keys.
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    -- signed-in people who ran a tool
    'active_users_7d', (select count(distinct user_id) from public.tool_runs where user_id is not null and created_at >= now() - interval '7 days'),
    'active_users_30d', (select count(distinct user_id) from public.tool_runs where user_id is not null and created_at >= now() - interval '30 days'),
    -- everyone who ran a tool, anonymous visitors counted by ip hash
    'visitors_7d', (select count(distinct coalesce(user_id::text, visitor_hash)) from public.tool_runs where created_at >= now() - interval '7 days'),
    'visitors_30d', (select count(distinct coalesce(user_id::text, visitor_hash)) from public.tool_runs where created_at >= now() - interval '30 days'),
    'runs_7d', (select count(*) from public.tool_runs where status = 'ok' and created_at >= now() - interval '7 days'),
    'runs_30d', (select count(*) from public.tool_runs where status = 'ok' and created_at >= now() - interval '30 days'),
    'runs_total', (select count(*) from public.tool_runs where status = 'ok'),
    'anon_runs_30d', (select count(*) from public.tool_runs where status = 'ok' and user_id is null and created_at >= now() - interval '30 days'),
    'errors_30d', (select count(*) from public.tool_runs where status <> 'ok' and created_at >= now() - interval '30 days'),
    'saved_7d', (select count(*) from public.user_activity_history where created_at >= now() - interval '7 days'),
    'saved_30d', (select count(*) from public.user_activity_history where created_at >= now() - interval '30 days'),
    'saved_total', (select count(*) from public.user_activity_history),
    'signups_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.bucket, 'count', coalesce(c.n, 0)) order by d.bucket), '[]'::jsonb)
      from generate_series((now() - interval '29 days')::date, now()::date, '1 day') d(bucket)
      left join (
        select created_at::date as bucket, count(*) as n
        from auth.users where created_at >= (now() - interval '29 days')::date group by 1
      ) c using (bucket)),
    'runs_by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', bucket, 'platform', platform, 'count', n) order by bucket, platform), '[]'::jsonb)
      from (
        select created_at::date as bucket, platform, count(*) as n
        from public.tool_runs
        where status = 'ok' and created_at >= (now() - interval '29 days')::date group by 1, 2
      ) x),
    'runs_by_tool', (
      select coalesce(jsonb_agg(jsonb_build_object('feature_type', feature, 'count', n) order by n desc), '[]'::jsonb)
      from (select feature, count(*) as n from public.tool_runs where status = 'ok' group by 1) x),
    'runs_by_page', (
      select coalesce(jsonb_agg(jsonb_build_object('page', page, 'platform', platform, 'count', n) order by n desc), '[]'::jsonb)
      from (select coalesce(page, '(none)') as page, platform, count(*) as n
            from public.tool_runs where status = 'ok' and created_at >= now() - interval '30 days'
            group by 1, 2 order by n desc limit 15) x),
    'saved_by_tool', (
      select coalesce(jsonb_agg(jsonb_build_object('feature_type', feature_type, 'count', n) order by n desc), '[]'::jsonb)
      from (select feature_type::text, count(*) n from public.user_activity_history group by 1) x)
  ) into r;
  return r;
end $$;

-- Users list: run_count = saved results (unchanged), tool_runs = real calls.
drop function if exists public.admin_users(text, int, int, text, text);
create or replace function public.admin_users(
  search text default null, lim int default 50, off int default 0,
  sort_by text default 'created_at', sort_dir text default 'desc')
returns table(user_id uuid, email text, full_name text, username text, avatar_url text,
              created_at timestamptz, last_sign_in_at timestamptz, run_count bigint,
              tool_runs bigint, last_run_at timestamptz, is_admin boolean, total_count bigint)
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
           coalesce(a.n, 0)::bigint, coalesce(t.n, 0)::bigint, t.last_at, coalesce(p.is_admin, false), count(*) over ()
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

-- User detail gains `runs` (latest 200 tool calls) and tool_runs count.
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
             coalesce(p.is_admin, false) is_admin
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

-- Global runs feed.
create or replace function public.admin_tool_runs(
  p_feature text default null, p_platform text default null, p_since timestamptz default null,
  p_status text default null, p_anon boolean default null,
  lim int default 100, off int default 0,
  sort_by text default 'created_at', sort_dir text default 'desc')
returns table(id uuid, created_at timestamptz, user_id uuid, email text, visitor_hash text,
              feature text, platform text, page text, status text, duration_ms integer, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  col text;
  dir text := case when lower(sort_dir) = 'asc' then 'asc' else 'desc' end;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  col := case sort_by
    when 'email' then 'u.email'
    when 'feature' then 't.feature'
    when 'platform' then 't.platform'
    when 'page' then 't.page'
    when 'status' then 't.status'
    when 'duration_ms' then 't.duration_ms'
    else 't.created_at'
  end;
  return query execute format($q$
    select t.id, t.created_at, t.user_id, u.email::text, t.visitor_hash,
           t.feature, t.platform, t.page, t.status, t.duration_ms, count(*) over ()
    from public.tool_runs t
    left join auth.users u on u.id = t.user_id
    where ($1 is null or t.feature = $1)
      and ($2 is null or t.platform = $2)
      and ($3 is null or t.created_at >= $3)
      and ($4 is null or t.status = $4)
      and ($5 is null or ($5 and t.user_id is null) or (not $5 and t.user_id is not null))
    order by %s %s nulls last, t.created_at desc
    limit $6 offset $7
  $q$, col, dir) using p_feature, p_platform, p_since, p_status, p_anon, lim, off;
end $$;
revoke all on function public.admin_tool_runs(text, text, timestamptz, text, boolean, int, int, text, text) from public;
grant execute on function public.admin_tool_runs(text, text, timestamptz, text, boolean, int, int, text, text) to authenticated;
