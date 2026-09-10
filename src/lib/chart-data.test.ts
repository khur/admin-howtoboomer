import { describe, it, expect } from "vitest";
import { pivotRunsByDay, platformKeys, shortDay } from "./chart-data";

const rows = [
  { day: "2026-09-02", platform: "web", count: 3 },
  { day: "2026-09-01", platform: "ios", count: 2 },
  { day: "2026-09-01", platform: "web", count: 5 },
  { day: "2026-09-03", platform: "unknown", count: 1 },
];

describe("platformKeys", () => {
  it("returns distinct platforms in canonical order with unknown last", () => {
    expect(platformKeys(rows)).toEqual(["web", "ios", "unknown"]);
  });
  it("is empty for no rows", () => {
    expect(platformKeys([])).toEqual([]);
  });
});

describe("pivotRunsByDay", () => {
  it("makes one row per day with every platform present, sorted by day", () => {
    expect(pivotRunsByDay(rows)).toEqual([
      { day: "2026-09-01", web: 5, ios: 2, unknown: 0 },
      { day: "2026-09-02", web: 3, ios: 0, unknown: 0 },
      { day: "2026-09-03", web: 0, ios: 0, unknown: 1 },
    ]);
  });
  it("fills gaps between the given range bounds when asked", () => {
    const out = pivotRunsByDay(rows.slice(0, 1), { from: "2026-09-01", to: "2026-09-03" });
    expect(out.map((r) => r.day)).toEqual(["2026-09-01", "2026-09-02", "2026-09-03"]);
    expect(out[1]).toEqual({ day: "2026-09-02", web: 3 });
    expect(out[0]).toEqual({ day: "2026-09-01", web: 0 });
  });
});

describe("shortDay", () => {
  it("renders 'Sep 1' style labels without timezone drift", () => {
    expect(shortDay("2026-09-01")).toBe("Sep 1");
    expect(shortDay("2026-12-25")).toBe("Dec 25");
  });
});
