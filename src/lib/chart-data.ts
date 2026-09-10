import { PLATFORMS } from "./types";

export interface RunsByDayRow {
  day: string;
  platform: string;
  count: number;
}

export type PivotedDay = { day: string } & Record<string, number | string>;

const ORDER: string[] = [...PLATFORMS];

/** Distinct platforms in canonical order (web, ios, android, unknown), unknown last. */
export function platformKeys(rows: RunsByDayRow[]): string[] {
  const seen = new Set(rows.map((r) => r.platform));
  const known = ORDER.filter((p) => seen.has(p));
  const extra = [...seen].filter((p) => !ORDER.includes(p)).sort();
  // Anything unexpected slots before "unknown".
  const unknownIdx = known.indexOf("unknown");
  return unknownIdx === -1
    ? [...known, ...extra]
    : [...known.slice(0, unknownIdx), ...extra, "unknown"];
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Long → wide: one object per day with a numeric column per platform.
 * Missing platform/day combinations are 0. Pass `range` to pad empty days.
 */
export function pivotRunsByDay(
  rows: RunsByDayRow[],
  range?: { from: string; to: string },
): PivotedDay[] {
  const keys = platformKeys(rows);
  const byDay = new Map<string, PivotedDay>();
  const blank = (day: string): PivotedDay => {
    const o: PivotedDay = { day };
    for (const k of keys) o[k] = 0;
    return o;
  };

  if (range) {
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) byDay.set(d, blank(d));
  }
  for (const r of rows) {
    const row = byDay.get(r.day) ?? blank(r.day);
    row[r.platform] = (row[r.platform] as number) + r.count;
    byDay.set(r.day, row);
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-01" → "Sep 1". Pure string math so the label never shifts by timezone. */
export function shortDay(isoDay: string): string {
  const [, m, d] = isoDay.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

/** Fixed series colors — validated with the dataviz palette checker against the card surface. */
export const PLATFORM_COLORS: Record<string, string> = {
  web: "#2a78d6",
  ios: "#b8321f",
  android: "#eda100",
  unknown: "#7a7368",
};

export function platformColor(platform: string): string {
  return PLATFORM_COLORS[platform] ?? PLATFORM_COLORS.unknown;
}
