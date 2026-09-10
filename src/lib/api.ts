// Typed wrappers around the admin RPCs and the `admin-users` edge function.
// Every function throws an Error with a readable message on failure so the
// pages can hand it straight to an ErrorBlock or toast.

import { supabase } from "./supabase";
import type { ActivityRow, AdminUser, Page, Sort, Stats, ToolRun } from "./types";

export const USERS_PAGE_SIZE = 50;
export const ACTIVITY_PAGE_SIZE = 100;
export const DEFAULT_SORT: Sort = { by: "created_at", dir: "desc" };

function fail(error: { message: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

/** Strip the window-function `total_count` off each row and lift it out. */
function toPage<T extends { total_count?: number | string }>(
  rows: T[] | null,
): Page<Omit<T, "total_count">> {
  const list = rows ?? [];
  const total = list.length ? Number(list[0].total_count ?? 0) : 0;
  return {
    rows: list.map(({ total_count: _omit, ...rest }) => rest),
    total,
  };
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) fail(error, "Could not check admin status.");
  return data === true;
}

export async function getStats(): Promise<Stats> {
  const { data, error } = await supabase.rpc("admin_stats");
  if (error) fail(error, "Could not load stats.");
  return data as Stats;
}

export async function listUsers(
  search: string,
  page: number,
  sort: Sort = DEFAULT_SORT,
  pageSize = USERS_PAGE_SIZE,
): Promise<Page<AdminUser>> {
  const trimmed = search.trim();
  const { data, error } = await supabase.rpc("admin_users", {
    search: trimmed ? trimmed : null,
    lim: pageSize,
    off: (page - 1) * pageSize,
    sort_by: sort.by,
    sort_dir: sort.dir,
  });
  if (error) fail(error, "Could not load users.");
  return toPage<AdminUser & { total_count: number }>(data);
}

export async function getUserDetail(
  userId: string,
): Promise<{ user: AdminUser; activity: ActivityRow[]; runs: ToolRun[] }> {
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user_id: userId });
  if (error) fail(error, "Could not load user.");
  const detail = data as { user: AdminUser | null; activity: ActivityRow[]; runs: ToolRun[] };
  if (!detail?.user) throw new Error("User not found.");
  return { user: detail.user, activity: detail.activity ?? [], runs: detail.runs ?? [] };
}

export interface RunFilters {
  feature?: string;
  platform?: string;
  since?: string;
  status?: string;
  /** "anon" | "signed_in" | "" */
  who?: string;
  page: number;
  pageSize?: number;
  sort?: Sort;
}

export async function listToolRuns(f: RunFilters): Promise<Page<ToolRun>> {
  const pageSize = f.pageSize ?? ACTIVITY_PAGE_SIZE;
  const sort = f.sort ?? DEFAULT_SORT;
  const { data, error } = await supabase.rpc("admin_tool_runs", {
    p_feature: f.feature || null,
    p_platform: f.platform || null,
    p_since: f.since || null,
    p_status: f.status || null,
    p_anon: f.who === "anon" ? true : f.who === "signed_in" ? false : null,
    lim: pageSize,
    off: (f.page - 1) * pageSize,
    sort_by: sort.by,
    sort_dir: sort.dir,
  });
  if (error) fail(error, "Could not load runs.");
  return toPage<ToolRun & { total_count: number }>(data);
}

export interface ActivityFilters {
  feature?: string;
  platform?: string;
  /** ISO timestamp; rows at or after this instant. */
  since?: string;
  page: number;
  pageSize?: number;
  sort?: Sort;
}

export async function listActivity(f: ActivityFilters): Promise<Page<ActivityRow>> {
  const pageSize = f.pageSize ?? ACTIVITY_PAGE_SIZE;
  const sort = f.sort ?? DEFAULT_SORT;
  const { data, error } = await supabase.rpc("admin_activity", {
    p_feature: f.feature || null,
    p_platform: f.platform || null,
    p_since: f.since || null,
    lim: pageSize,
    off: (f.page - 1) * pageSize,
    sort_by: sort.by,
    sort_dir: sort.dir,
  });
  if (error) fail(error, "Could not load activity.");
  return toPage<ActivityRow & { total_count: number }>(data);
}

export async function updateProfile(
  userId: string,
  patch: { full_name?: string; username?: string },
): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", userId);
  if (error) fail(error, "Could not save profile.");
}

/** No redirectTo: Supabase falls back to the project's Site URL. */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) fail(error, "Could not send reset email.");
}

export async function deleteUser(userId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("admin-users", {
    body: { action: "delete", userId },
  });
  if (error) {
    // Non-2xx: the function's JSON error body is on the response.
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const body = await ctx.json().catch(() => null);
      if (body?.error) throw new Error(body.error);
    }
    fail(error as { message: string }, "Delete failed.");
  }
  if (data?.error) throw new Error(data.error);
}
