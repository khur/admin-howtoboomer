import { describe, it, expect } from "vitest";
import { formatDate, formatRelative, featureLabel, preview } from "./format";

describe("formatDate", () => {
  it("renders a short US date", () => {
    expect(formatDate("2026-09-10T15:00:00Z")).toBe("Sep 10, 2026");
  });
  it("renders a dash for null/undefined", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  it("says never for null", () => {
    expect(formatRelative(null, now)).toBe("never");
  });
  it("uses minutes, hours, days", () => {
    expect(formatRelative("2026-09-10T11:59:30Z", now)).toBe("just now");
    expect(formatRelative("2026-09-10T11:15:00Z", now)).toBe("45m ago");
    expect(formatRelative("2026-09-10T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelative("2026-09-08T12:00:00Z", now)).toBe("2d ago");
  });
  it("falls back to a date after 30 days", () => {
    expect(formatRelative("2026-06-01T12:00:00Z", now)).toBe("Jun 1, 2026");
  });
});

describe("featureLabel", () => {
  it("maps known feature keys", () => {
    expect(featureLabel("shame_detector")).toBe("Shame Detector");
    expect(featureLabel("generate_response")).toBe("Response Generator");
  });
  it("passes unknown keys through", () => {
    expect(featureLabel("something_new")).toBe("something_new");
  });
});

describe("preview", () => {
  it("returns short text unchanged", () => {
    expect(preview("hello")).toBe("hello");
  });
  it("truncates to the limit with an ellipsis", () => {
    const long = "a".repeat(100);
    expect(preview(long)).toBe("a".repeat(80) + "…");
    expect(preview(long, 10)).toBe("aaaaaaaaaa…");
  });
  it("collapses whitespace", () => {
    expect(preview("a\n\n  b")).toBe("a b");
  });
});
