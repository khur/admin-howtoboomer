-- Rows reconstructed from Supabase edge-function logs (June–Sept 2026) are
-- marked source = 'backfill'. They have exact time, platform, user id, status
-- and duration, but no page and feature = 'unknown' (the tool was only in the
-- request body). visitor_hash for these uses a different salt than live rows,
-- so one anonymous visitor may appear as two across the cutover.
alter table public.tool_runs add column if not exists source text not null default 'live';
create extension if not exists pgcrypto with schema extensions;
