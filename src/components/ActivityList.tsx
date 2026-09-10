import { Fragment, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ActivityRow, Sort, SortDir } from "@/lib/types";
import { SortHeader } from "./SortHeader";
import { featureLabel, formatDateTime, preview } from "@/lib/format";
import { PlatformBadge } from "./PlatformBadge";

/**
 * Activity rows with a click-to-expand panel showing the full input and the
 * JSON the tool returned. Used by the user detail page and the global feed.
 */
export function ActivityList({
  rows,
  showUser = false,
  emptyText = "No activity yet.",
  sort,
  onSort,
}: {
  rows: ActivityRow[];
  showUser?: boolean;
  emptyText?: string;
  sort?: Sort;
  onSort?: (key: string, defaultDir: SortDir) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const cols = showUser ? 5 : 4;

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-edge bg-surface-soft text-left">
            <SortHeader label="When" sortKey="created_at" defaultDir="desc" sort={sort} onSort={onSort} className="w-44" />
            {showUser && <SortHeader label="User" sortKey="email" sort={sort} onSort={onSort} />}
            <SortHeader label="Tool" sortKey="feature_type" sort={sort} onSort={onSort} />
            <SortHeader label="Platform" sortKey="platform" sort={sort} onSort={onSort} />
            <SortHeader label="Input" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="px-4 py-10 text-center text-muted">{emptyText}</td>
            </tr>
          )}
          {rows.map((r) => {
            const expanded = open.has(r.id);
            return (
              <Fragment key={r.id}>
                <tr
                  className="border-b border-hairline cursor-pointer hover:bg-surface-soft focus-within:bg-surface-soft"
                  onClick={() => toggle(r.id)}
                >
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-semibold text-ink"
                      aria-expanded={expanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(r.id);
                      }}
                    >
                      {expanded ? <ChevronDown aria-hidden className="size-4" /> : <ChevronRight aria-hidden className="size-4" />}
                      {formatDateTime(r.created_at)}
                    </button>
                  </td>
                  {showUser && (
                    <td className="px-4 py-3 align-top">
                      {r.user_id ? (
                        <Link
                          to={`/users/${r.user_id}`}
                          className="font-semibold text-ink underline decoration-hairline hover:decoration-brick"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.email ?? r.user_id}
                        </Link>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 align-top whitespace-nowrap">{featureLabel(r.feature_type)}</td>
                  <td className="px-4 py-3 align-top"><PlatformBadge platform={r.platform} /></td>
                  <td className="px-4 py-3 align-top text-body">{preview(r.input_text)}</td>
                </tr>
                {expanded && (
                  <tr className="border-b border-hairline bg-surface-soft/60">
                    <td colSpan={cols} className="px-4 py-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="label">Input</p>
                          <p className="whitespace-pre-wrap text-body bg-surface border border-edge p-3">{r.input_text}</p>
                        </div>
                        <div>
                          <p className="label">Output</p>
                          <pre className="text-xs font-mono whitespace-pre-wrap break-words bg-surface border border-edge p-3 max-h-96 overflow-auto">
                            {JSON.stringify(r.output_json, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
