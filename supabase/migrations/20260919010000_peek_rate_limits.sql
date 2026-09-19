-- Read-only companion to check_and_increment_rate_limits: what is the caller's
-- daily limit and how much of it is used, without consuming a run. The edge
-- function calls it for `{ "peek": true }` requests so the tools page can show
-- "N of M free runs left today" before the visitor's first run.
create or replace function public.peek_rate_limits(p_ip text, p_user_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = 'public' as $$
declare
  s record;
  v_day_key text;
  v_day_limit int;
  v_used int;
begin
  select anon_daily_limit, user_daily_limit into s from app_settings where id = true;
  if not found then
    select 7 as anon_daily_limit, 100 as user_daily_limit into s;
  end if;

  if p_user_id is null then
    v_day_key := 'ip:' || p_ip || ':day';
    v_day_limit := s.anon_daily_limit;
  else
    v_day_key := 'user:' || p_user_id::text || ':day';
    v_day_limit := coalesce(
      (select p.daily_run_limit from profiles p where p.user_id = p_user_id),
      s.user_daily_limit);
  end if;

  select coalesce(count, 0) into v_used
  from edge_rate_limits
  where key = v_day_key and window_start = date_trunc('day', now());
  if not found then v_used := 0; end if;

  return jsonb_build_object('limit', v_day_limit, 'used', least(v_used, v_day_limit));
end $$;

revoke all on function public.peek_rate_limits(text, uuid) from public;
grant execute on function public.peek_rate_limits(text, uuid) to service_role;
