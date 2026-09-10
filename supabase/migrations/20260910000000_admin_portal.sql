-- Admin portal: one flag on profiles, is_admin() helper, admin RLS, admin RPCs.
--
-- Permission model: `profiles.is_admin`. Every cross-user read/write below is
-- gated by public.is_admin(), which is SECURITY DEFINER so the profiles policy
-- can call it without recursing into its own RLS. Users can already insert and
-- update their own profile row, so a trigger stops them flipping is_admin.

alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.user_id = (select auth.uid())),
    false
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.profiles_guard_is_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- No user JWT (service role, dashboard SQL, migrations) is trusted; the
  -- guard exists for authenticated end users editing their own row.
  if (select auth.uid()) is null then return new; end if;
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

-- Admin RLS ------------------------------------------------------------------
drop policy if exists admin_select_all on public.profiles;
create policy admin_select_all on public.profiles
  for select to authenticated using ((select public.is_admin()));
drop policy if exists admin_update_all on public.profiles;
create policy admin_update_all on public.profiles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists admin_select_all on public.user_activity_history;
create policy admin_select_all on public.user_activity_history
  for select to authenticated using ((select public.is_admin()));

create index if not exists user_activity_history_created_at_idx
  on public.user_activity_history (created_at desc);
create index if not exists user_activity_history_user_created_idx
  on public.user_activity_history (user_id, created_at desc);

-- Stats ----------------------------------------------------------------------
create or replace function public.admin_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'total_users', (select count(*) from auth.users),
    'new_users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'active_users_7d', (select count(distinct user_id) from public.user_activity_history where created_at >= now() - interval '7 days'),
    'active_users_30d', (select count(distinct user_id) from public.user_activity_history where created_at >= now() - interval '30 days'),
    'runs_7d', (select count(*) from public.user_activity_history where created_at >= now() - interval '7 days'),
    'runs_30d', (select count(*) from public.user_activity_history where created_at >= now() - interval '30 days'),
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
        select created_at::date as bucket, coalesce(metadata->>'platform', 'unknown') as platform, count(*) as n
        from public.user_activity_history
        where created_at >= (now() - interval '29 days')::date group by 1, 2
      ) x),
    'runs_by_tool', (
      select coalesce(jsonb_agg(jsonb_build_object('feature_type', feature_type, 'count', n) order by n desc), '[]'::jsonb)
      from (select feature_type::text, count(*) n from public.user_activity_history group by 1) x)
  ) into r;
  return r;
end $$;

-- Users list -----------------------------------------------------------------
-- LEFT JOIN from auth.users: some users have no profiles row.
create or replace function public.admin_users(search text default null, lim int default 50, off int default 0)
returns table(user_id uuid, email text, full_name text, username text, avatar_url text,
              created_at timestamptz, last_sign_in_at timestamptz, run_count bigint,
              is_admin boolean, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select u.id, u.email::text, p.full_name, p.username, p.avatar_url, u.created_at, u.last_sign_in_at,
           coalesce(a.n, 0)::bigint, coalesce(p.is_admin, false), count(*) over ()
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join (select h.user_id, count(*) n from public.user_activity_history h group by 1) a on a.user_id = u.id
    where search is null or search = ''
       or u.email ilike '%' || search || '%'
       or p.full_name ilike '%' || search || '%'
    order by u.created_at desc
    limit lim offset off;
end $$;

-- One user + their activity --------------------------------------------------
create or replace function public.admin_user_detail(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select jsonb_build_object(
    'user', (select to_jsonb(x) from (
      select u.id user_id, u.email, p.full_name, p.username, p.avatar_url, u.created_at, u.last_sign_in_at,
             (select count(*) from public.user_activity_history h where h.user_id = u.id) run_count,
             coalesce(p.is_admin, false) is_admin
      from auth.users u left join public.profiles p on p.user_id = u.id
      where u.id = p_user_id) x),
    'activity', (select coalesce(jsonb_agg(to_jsonb(y) order by y.created_at desc), '[]'::jsonb) from (
      select h.id, h.created_at, h.feature_type::text, coalesce(h.metadata->>'platform', 'unknown') platform,
             h.input_text, h.output_json, h.metadata
      from public.user_activity_history h
      where h.user_id = p_user_id order by h.created_at desc limit 500) y)
  ) into r;
  return r;
end $$;

-- Global activity feed -------------------------------------------------------
create or replace function public.admin_activity(p_feature text default null, p_platform text default null,
                                                 p_since timestamptz default null, lim int default 100, off int default 0)
returns table(id uuid, created_at timestamptz, user_id uuid, email text, feature_type text, platform text,
              input_text text, output_json jsonb, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
    select h.id, h.created_at, h.user_id, u.email::text, h.feature_type::text,
           coalesce(h.metadata->>'platform', 'unknown'), h.input_text, h.output_json, count(*) over ()
    from public.user_activity_history h
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
