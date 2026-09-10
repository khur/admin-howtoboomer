import { describe, it, expect } from "vitest";
import { nextSort, parseSort, sortParam, sortRows } from "./sort";

describe("nextSort", () => {
  it("starts a new column at its default direction and toggles on repeat", () => {
    const current = { by: "created_at", dir: "desc" as const };
    expect(nextSort(current, "email", "asc")).toEqual({ by: "email", dir: "asc" });
    expect(nextSort(current, "created_at", "desc")).toEqual({ by: "created_at", dir: "asc" });
    expect(nextSort({ by: "email", dir: "asc" }, "email", "asc")).toEqual({ by: "email", dir: "desc" });
  });
});

describe("parseSort / sortParam", () => {
  const fallback = { by: "created_at", dir: "desc" as const };
  it("round-trips through a single query param", () => {
    expect(sortParam({ by: "email", dir: "asc" })).toBe("email.asc");
    expect(parseSort("email.asc", ["email", "created_at"], fallback)).toEqual({ by: "email", dir: "asc" });
  });
  it("falls back on garbage or unknown columns", () => {
    expect(parseSort(null, ["email"], fallback)).toEqual(fallback);
    expect(parseSort("nope.asc", ["email"], fallback)).toEqual(fallback);
    expect(parseSort("email.sideways", ["email"], fallback)).toEqual(fallback);
  });
});

describe("sortRows", () => {
  const rows = [
    { n: "b", when: "2026-01-02", x: null },
    { n: "a", when: "2026-01-03", x: 2 },
    { n: "c", when: "2026-01-01", x: 1 },
  ];
  it("sorts strings and dates in either direction without mutating input", () => {
    expect(sortRows(rows, { by: "n", dir: "asc" }).map((r) => r.n)).toEqual(["a", "b", "c"]);
    expect(sortRows(rows, { by: "when", dir: "desc" }).map((r) => r.n)).toEqual(["a", "b", "c"]);
    expect(rows[0].n).toBe("b");
  });
  it("puts nulls last regardless of direction", () => {
    expect(sortRows(rows, { by: "x", dir: "asc" }).map((r) => r.n)).toEqual(["c", "a", "b"]);
    expect(sortRows(rows, { by: "x", dir: "desc" }).map((r) => r.n)).toEqual(["a", "c", "b"]);
  });
});
