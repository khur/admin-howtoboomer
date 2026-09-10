import { useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ACTIVITY_PAGE_SIZE, DEFAULT_SORT, listToolRuns } from "@/lib/api";
import { FEATURE_TYPES, PLATFORMS, RUN_STATUSES } from "@/lib/types";
import { featureLabel, formatNumber, platformLabel, statusLabel } from "@/lib/format";
import { nextSort, parseSort, sortParam } from "@/lib/sort";
import { PageHeader } from "@/components/PageHeader";
import { RunsList } from "@/components/RunsList";
import { Pagination } from "@/components/Pagination";
import { ErrorBlock } from "@/components/ErrorBlock";
import { Spinner } from "@/components/Spinner";

const SORT_KEYS = ["created_at", "email", "feature", "platform", "page", "status", "duration_ms"];

export function Runs() {
  const [params, setParams] = useSearchParams();
  const feature = params.get("tool") ?? "";
  const platform = params.get("platform") ?? "";
  const status = params.get("status") ?? "";
  const who = params.get("who") ?? "";
  const sinceDay = params.get("since") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const sort = parseSort(params.get("sort"), SORT_KEYS, DEFAULT_SORT);
  const since = sinceDay ? new Date(`${sinceDay}T00:00:00`).toISOString() : undefined;
  const hasFilters = !!(feature || platform || status || who || sinceDay);

  const q = useQuery({
    queryKey: ["runs", feature, platform, status, who, since, page, sort],
    queryFn: () => listToolRuns({ feature, platform, status, who, since, page, sort }),
    placeholderData: keepPreviousData,
  });

  function update(patch: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: !("page" in patch) });
  }

  return (
    <>
      <PageHeader
        title="Runs"
        subtitle={
          q.data
            ? `${formatNumber(q.data.total)} AI calls — every tool run from web and the app, signed in or not`
            : "Every tool run from web and the app, signed in or not"
        }
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label htmlFor="tool" className="label">Tool</label>
          <select id="tool" className="field w-48" value={feature} onChange={(e) => update({ tool: e.target.value })}>
            <option value="">All tools</option>
            {FEATURE_TYPES.map((f) => <option key={f} value={f}>{featureLabel(f)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="platform" className="label">Platform</label>
          <select id="platform" className="field w-40" value={platform} onChange={(e) => update({ platform: e.target.value })}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => <option key={p} value={p}>{platformLabel(p)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="who" className="label">Who</label>
          <select id="who" className="field w-40" value={who} onChange={(e) => update({ who: e.target.value })}>
            <option value="">Everyone</option>
            <option value="signed_in">Signed in</option>
            <option value="anon">Anonymous</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" className="field w-40" value={status} onChange={(e) => update({ status: e.target.value })}>
            <option value="">Any status</option>
            {RUN_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="since" className="label">Since</label>
          <input id="since" type="date" className="field w-44" value={sinceDay} onChange={(e) => update({ since: e.target.value })} />
        </div>
        {hasFilters && (
          <div className="self-end">
            <button type="button" className="btn" onClick={() => update({ tool: "", platform: "", status: "", who: "", since: "" })}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {q.isPending && <Spinner label="Loading runs…" />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && (
        <div className={q.isPlaceholderData ? "opacity-60" : ""}>
          <RunsList
            rows={q.data.rows}
            showUser
            sort={sort}
            onSort={(key, dir) => update({ sort: sortParam(nextSort(sort, key, dir)) })}
            emptyText={hasFilters ? "No runs match these filters." : "No runs recorded yet — they appear as soon as someone uses a tool."}
          />
          <Pagination page={page} total={q.data.total} pageSize={ACTIVITY_PAGE_SIZE} onChange={(p) => update({ page: String(p) })} />
        </div>
      )}
    </>
  );
}
