import { Link } from "react-router";
import type { Sort, SortDir, ToolRun } from "@/lib/types";
import { featureLabel, formatDateTime, formatDuration, statusLabel } from "@/lib/format";
import { SortHeader } from "./SortHeader";
import { PlatformBadge } from "./PlatformBadge";

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ok" ? "bg-success-fill" : status === "rate_limited" ? "bg-surface-soft" : "bg-error-fill";
  return <span className={`badge ${tone}`}>{statusLabel(status)}</span>;
}

/**
 * Table of AI calls from `tool_runs`. `showUser` adds the who-column
 * (email link, or an anonymous visitor tag) for the global feed.
 */
export function RunsList({
  rows,
  showUser = false,
  emptyText = "No runs yet.",
  sort,
  onSort,
}: {
  rows: ToolRun[];
  showUser?: boolean;
  emptyText?: string;
  sort?: Sort;
  onSort?: (key: string, defaultDir: SortDir) => void;
}) {
  const cols = showUser ? 7 : 6;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-edge bg-surface-soft text-left">
            <SortHeader label="When" sortKey="created_at" defaultDir="desc" sort={sort} onSort={onSort} className="whitespace-nowrap" />
            {showUser && <SortHeader label="Who" sortKey="email" sort={sort} onSort={onSort} />}
            <SortHeader label="Tool" sortKey="feature" sort={sort} onSort={onSort} />
            <SortHeader label="Platform" sortKey="platform" sort={sort} onSort={onSort} />
            <SortHeader label="Page" sortKey="page" sort={sort} onSort={onSort} />
            <SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
            <SortHeader label="Time" sortKey="duration_ms" defaultDir="desc" sort={sort} onSort={onSort} className="text-right" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols} className="px-4 py-10 text-center text-muted">{emptyText}</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-hairline last:border-b-0">
              <td className="px-4 py-3 align-top whitespace-nowrap">{formatDateTime(r.created_at)}</td>
              {showUser && (
                <td className="px-4 py-3 align-top">
                  {r.user_id ? (
                    <Link to={`/users/${r.user_id}`} className="font-semibold text-ink underline decoration-hairline hover:decoration-brick">
                      {r.email ?? r.user_id}
                    </Link>
                  ) : (
                    <span className="text-muted" title={r.visitor_hash ? `visitor ${r.visitor_hash}` : undefined}>
                      anonymous{r.visitor_hash ? ` · ${r.visitor_hash.slice(0, 6)}` : ""}
                    </span>
                  )}
                </td>
              )}
              <td className="px-4 py-3 align-top whitespace-nowrap">{featureLabel(r.feature)}</td>
              <td className="px-4 py-3 align-top"><PlatformBadge platform={r.platform} /></td>
              <td className="px-4 py-3 align-top font-mono text-xs break-all">{r.page ?? <span className="text-muted">—</span>}</td>
              <td className="px-4 py-3 align-top"><StatusBadge status={r.status} /></td>
              <td className="px-4 py-3 align-top text-right tabular-nums whitespace-nowrap">{formatDuration(r.duration_ms)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
