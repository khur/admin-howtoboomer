import type { Sort, SortDir } from "./types";

/** Click on a header: new column → its natural direction; same column → flip. */
export function nextSort(current: Sort, by: string, defaultDir: SortDir): Sort {
  if (current.by !== by) return { by, dir: defaultDir };
  return { by, dir: current.dir === "asc" ? "desc" : "asc" };
}

/** `email.asc` — the shape we keep in the URL so sorts are shareable/bookmarkable. */
export function sortParam(s: Sort): string {
  return `${s.by}.${s.dir}`;
}

export function parseSort(raw: string | null, allowed: readonly string[], fallback: Sort): Sort {
  if (!raw) return fallback;
  const [by, dir] = raw.split(".");
  if (!allowed.includes(by) || (dir !== "asc" && dir !== "desc")) return fallback;
  return { by, dir };
}

/** Client-side sort for lists that are fully loaded. Nulls always sort last. */
export function sortRows<T extends object>(rows: T[], sort: Sort): T[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sort.by];
    const bv = (b as Record<string, unknown>)[sort.by];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}
