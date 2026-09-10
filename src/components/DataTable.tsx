import type { ReactNode } from "react";
import type { Sort, SortDir } from "@/lib/types";
import { SortHeader } from "./SortHeader";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** Present → the header sorts by this key. */
  sortKey?: string;
  /** Direction used the first time the column is clicked. */
  defaultDir?: SortDir;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyText = "Nothing here yet.",
  sort,
  onSort,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyText?: string;
  sort?: Sort;
  onSort?: (key: string, defaultDir: SortDir) => void;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-edge bg-surface-soft text-left">
            {columns.map((c) => (
              <SortHeader
                key={c.key}
                label={c.header}
                sortKey={c.sortKey}
                defaultDir={c.defaultDir}
                sort={sort}
                onSort={onSort}
                className={c.className}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-muted">
                {emptyText}
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
              className={`border-b border-hairline last:border-b-0 ${
                onRowClick ? "cursor-pointer hover:bg-surface-soft focus-visible:bg-surface-soft" : ""
              }`}
            >
              {columns.map((c) => (
                <td key={c.key} className={`px-4 py-3 align-top ${c.className ?? ""}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
