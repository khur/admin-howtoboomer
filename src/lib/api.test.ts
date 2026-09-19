import { describe, it, expect, vi, beforeEach } from "vitest";

const { rpc, invoke, eq, update, from, single, resetPasswordForEmail } = vi.hoisted(() => {
  const eq = vi.fn();
  const single = vi.fn();
  const update = vi.fn(() => ({ eq }));
  const select = vi.fn(() => ({ eq: vi.fn(() => ({ single })) }));
  return {
    rpc: vi.fn(),
    invoke: vi.fn(),
    eq,
    update,
    select,
    single,
    from: vi.fn(() => ({ update, select })),
    resetPasswordForEmail: vi.fn(),
  };
});

vi.mock("./supabase", () => ({
  supabase: {
    rpc,
    from,
    functions: { invoke },
    auth: { resetPasswordForEmail },
  },
}));

import {
  checkIsAdmin,
  getStats,
  listUsers,
  getUserDetail,
  listActivity,
  listToolRuns,
  updateProfile,
  sendPasswordReset,
  deleteUser,
  getSettings,
  saveSettings,
} from "./api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkIsAdmin", () => {
  it("returns true only when the rpc says true", async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await checkIsAdmin()).toBe(true);
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await checkIsAdmin()).toBe(false);
    expect(rpc).toHaveBeenCalledWith("is_admin");
  });
});

describe("getStats", () => {
  it("returns the json and throws on error", async () => {
    rpc.mockResolvedValueOnce({ data: { total_users: 3 }, error: null });
    expect(await getStats()).toEqual({ total_users: 3 });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    await expect(getStats()).rejects.toThrow("nope");
  });
});

describe("listUsers", () => {
  it("passes search and page offsets and unwraps total_count", async () => {
    rpc.mockResolvedValueOnce({
      data: [
        { user_id: "a", total_count: 120 },
        { user_id: "b", total_count: 120 },
      ],
      error: null,
    });
    const page = await listUsers("bob", 2);
    expect(rpc).toHaveBeenCalledWith("admin_users", {
      search: "bob", lim: 50, off: 50, sort_by: "created_at", sort_dir: "desc",
    });
    expect(page.total).toBe(120);
    expect(page.rows.map((r) => r.user_id)).toEqual(["a", "b"]);
    expect("total_count" in page.rows[0]).toBe(false);
  });
  it("sends null for a blank search and total 0 when empty", async () => {
    rpc.mockResolvedValueOnce({ data: [], error: null });
    const page = await listUsers("  ", 1, { by: "run_count", dir: "asc" });
    expect(rpc).toHaveBeenCalledWith("admin_users", {
      search: null, lim: 50, off: 0, sort_by: "run_count", sort_dir: "asc",
    });
    expect(page).toEqual({ rows: [], total: 0 });
  });
});

describe("getUserDetail", () => {
  it("calls the rpc with p_user_id and rejects a missing user", async () => {
    rpc.mockResolvedValueOnce({ data: { user: { user_id: "x" }, activity: [] }, error: null });
    expect((await getUserDetail("x")).user.user_id).toBe("x");
    expect(rpc).toHaveBeenCalledWith("admin_user_detail", { p_user_id: "x" });
    rpc.mockResolvedValueOnce({ data: { user: null, activity: [] }, error: null });
    await expect(getUserDetail("nope")).rejects.toThrow("User not found");
  });
});

describe("listActivity", () => {
  it("maps filters to rpc params with nulls for 'all'", async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: "1", total_count: 7 }], error: null });
    const page = await listActivity({ feature: "translator", page: 3, pageSize: 20, sort: { by: "email", dir: "asc" } });
    expect(rpc).toHaveBeenCalledWith("admin_activity", {
      p_feature: "translator",
      p_platform: null,
      p_since: null,
      lim: 20,
      off: 40,
      sort_by: "email",
      sort_dir: "asc",
    });
    expect(page.total).toBe(7);
  });
});

describe("listToolRuns", () => {
  it("maps the who filter to p_anon and passes status", async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: "r1", total_count: 3 }], error: null });
    const page = await listToolRuns({ who: "anon", status: "error", page: 1 });
    expect(rpc).toHaveBeenCalledWith("admin_tool_runs", {
      p_feature: null,
      p_platform: null,
      p_since: null,
      p_status: "error",
      p_anon: true,
      lim: 100,
      off: 0,
      sort_by: "created_at",
      sort_dir: "desc",
    });
    expect(page.total).toBe(3);
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await listToolRuns({ who: "signed_in", page: 1 });
    expect(rpc).toHaveBeenLastCalledWith("admin_tool_runs", expect.objectContaining({ p_anon: false, p_status: null }));
  });
});

describe("updateProfile", () => {
  it("updates the profiles row by user_id", async () => {
    eq.mockResolvedValueOnce({ error: null });
    await updateProfile("u1", { full_name: "Bob" });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ full_name: "Bob" });
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });
});

describe("sendPasswordReset", () => {
  it("delegates to supabase auth", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    await sendPasswordReset("A@B.com");
    expect(resetPasswordForEmail).toHaveBeenCalledWith("a@b.com");
  });
});

describe("deleteUser", () => {
  it("invokes the admin-users function and surfaces its error body", async () => {
    invoke.mockResolvedValueOnce({ data: { success: true }, error: null });
    await deleteUser("x");
    expect(invoke).toHaveBeenCalledWith("admin-users", { body: { action: "delete", userId: "x" } });

    invoke.mockResolvedValueOnce({ data: { error: "Not authorized." }, error: null });
    await expect(deleteUser("x")).rejects.toThrow("Not authorized.");
  });
  it("reads the error message out of a non-2xx response", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: { context: new Response(JSON.stringify({ error: "userId must be a uuid." }), { status: 400 }) },
    });
    await expect(deleteUser("bad")).rejects.toThrow("userId must be a uuid.");
  });
});

describe("settings", () => {
  const patch = { anon_daily_limit: 5, user_daily_limit: 100, ip_minute_limit: 8, global_daily_limit: 500 };

  it("getSettings reads the single row", async () => {
    single.mockResolvedValueOnce({ data: { ...patch, updated_at: "2026-09-19" }, error: null });
    expect(await getSettings()).toEqual({ ...patch, updated_at: "2026-09-19" });
    expect(from).toHaveBeenCalledWith("app_settings");
    single.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(getSettings()).rejects.toThrow("denied");
  });

  it("saveSettings updates the row and throws on error", async () => {
    eq.mockResolvedValueOnce({ error: null });
    await saveSettings(patch);
    expect(from).toHaveBeenCalledWith("app_settings");
    expect(update).toHaveBeenCalledWith(patch);
    expect(eq).toHaveBeenCalledWith("id", true);
    eq.mockResolvedValueOnce({ error: { message: "denied" } });
    await expect(saveSettings(patch)).rejects.toThrow("denied");
  });
});

describe("updateProfile daily_run_limit", () => {
  it("passes the override through, including null to clear it", async () => {
    eq.mockResolvedValueOnce({ error: null });
    await updateProfile("u1", { daily_run_limit: null });
    expect(update).toHaveBeenCalledWith({ daily_run_limit: null });
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
  });
});
