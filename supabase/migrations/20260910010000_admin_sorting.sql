-- Server-side sorting for the paginated admin lists. Both RPCs gain
-- (sort_by, sort_dir); the column is mapped through a whitelist and the
-- direction is coerced, so the dynamic ORDER BY can't be injected.

drop function if exists public.admin_users(text, int, int);
drop function if exists public.admin_activity(text, text, timestamptz, int, int);

create or replace function public.admin_users(
  search text default null, lim int default 50, off int default 0,
  sort_by text default 'created_at', sort_dir text default 'desc')
returns table(user_id uuid, email text, full_name text, username text, avatar_url text,
              created_at timestamptz, last_sign_in_at timestamptz, run_count bigint,
              is_admin boolean, total_count bigint)
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
    else 'u.created_at'
  end;
  return query execute format($q$
    select u.id, u.email::text, p.full_name, p.username, p.avatar_url, u.created_at, u.last_sign_in_at,
           coalesce(a.n, 0)::bigint, coalesce(p.is_admin, false), count(*) over ()
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join (select h.user_id, count(*) n from public.user_activity_history h group by 1) a on a.user_id = u.id
    where $1 is null or $1 = ''
       or u.email ilike '%%' || $1 || '%%'
       or p.full_name ilike '%%' || $1 || '%%'
    order by %s %s nulls last, u.created_at desc
    limit $2 offset $3
  $q$, col, dir) using search, lim, off;
end $$;

create or replace function public.admin_activity(
  p_feature text default null, p_platform text default null, p_since timestamptz default null,
  lim int default 100, off int default 0,
  sort_by text default 'created_at', sort_dir text default 'desc')
returns table(id uuid, created_at timestamptz, user_id uuid, email text, feature_type text, platform text,
              input_text text, output_json jsonb, total_count bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  col text;
  dir text := case when lower(sort_dir) = 'asc' then 'asc' else 'desc' end;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  col := case sort_by
    when 'email' then 'u.email'
    when 'feature_type' then 'h.feature_type::text'
    when 'platform' then 'coalesce(h.metadata->>''platform'', ''unknown'')'
    else 'h.created_at'
  end;
  return query execute format($q$
    select h.id, h.created_at, h.user_id, u.email::text, h.feature_type::text,
           coalesce(h.metadata->>'platform', 'unknown'), h.input_text, h.output_json, count(*) over ()
    from public.user_activity_history h
    left join auth.users u on u.id = h.user_id
    where ($1 is null or h.feature_type::text = $1)
      and ($2 is null or coalesce(h.metadata->>'platform', 'unknown') = $2)
      and ($3 is null or h.created_at >= $3)
    order by %s %s nulls last, h.created_at desc
    limit $4 offset $5
  $q$, col, dir) using p_feature, p_platform, p_since, lim, off;
end $$;

revoke all on function public.admin_users(text, int, int, text, text) from public;
revoke all on function public.admin_activity(text, text, timestamptz, int, int, text, text) from public;
grant execute on function public.admin_users(text, int, int, text, text) to authenticated;
grant execute on function public.admin_activity(text, text, timestamptz, int, int, text, text) to authenticated;
