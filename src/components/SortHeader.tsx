import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { Sort, SortDir } from "@/lib/types";

/**
 * A `<th>` that sorts. Renders as a button so it's keyboard-operable and
 * sets aria-sort so the active column is announced.
 */
export function SortHeader({
  label,
  sortKey,
  sort,
  defaultDir = "asc",
  onSort,
  className = "",
}: {
  label: string;
  sortKey?: string;
  sort?: Sort;
  defaultDir?: SortDir;
  onSort?: (key: string, defaultDir: SortDir) => void;
  className?: string;
}) {
  const sortable = !!sortKey && !!onSort;
  const active = sortable && sort?.by === sortKey;
  const Icon = active ? (sort!.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <th
      scope="col"
      aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
      className={`px-4 py-3 font-semibold ${className}`}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onSort(sortKey, defaultDir)}
          className={`inline-flex items-center gap-1 -mx-1 px-1 py-1 hover:text-brick ${active ? "text-ink" : "text-body"}`}
        >
          {label}
          <Icon aria-hidden className={`size-3.5 ${active ? "" : "opacity-50"}`} />
        </button>
      ) : (
        label
      )}
    </th>
  );
}
