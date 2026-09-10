import { useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ACTIVITY_PAGE_SIZE, listActivity } from "@/lib/api";
import { FEATURE_TYPES, PLATFORMS } from "@/lib/types";
import { featureLabel, formatNumber, platformLabel } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { ActivityList } from "@/components/ActivityList";
import { Pagination } from "@/components/Pagination";
import { ErrorBlock } from "@/components/ErrorBlock";
import { Spinner } from "@/components/Spinner";

export function Activity() {
  const [params, setParams] = useSearchParams();
  const feature = params.get("tool") ?? "";
  const platform = params.get("platform") ?? "";
  const sinceDay = params.get("since") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? 1));

  // A date input gives "YYYY-MM-DD"; send local midnight of that day.
  const since = sinceDay ? new Date(`${sinceDay}T00:00:00`).toISOString() : undefined;

  const q = useQuery({
    queryKey: ["activity", feature, platform, since, page],
    queryFn: () => listActivity({ feature, platform, since, page }),
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
        title="Activity"
        subtitle={q.data ? `${formatNumber(q.data.total)} tool runs` : undefined}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div>
          <label htmlFor="tool" className="label">Tool</label>
          <select id="tool" className="field w-52" value={feature} onChange={(e) => update({ tool: e.target.value })}>
            <option value="">All tools</option>
            {FEATURE_TYPES.map((f) => (
              <option key={f} value={f}>{featureLabel(f)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="platform" className="label">Platform</label>
          <select id="platform" className="field w-44" value={platform} onChange={(e) => update({ platform: e.target.value })}>
            <option value="">All platforms</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>{platformLabel(p)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="since" className="label">Since</label>
          <input id="since" type="date" className="field w-44" value={sinceDay} onChange={(e) => update({ since: e.target.value })} />
        </div>
        {(feature || platform || sinceDay) && (
          <div className="self-end">
            <button type="button" className="btn" onClick={() => update({ tool: "", platform: "", since: "" })}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {q.isPending && <Spinner label="Loading activity…" />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && (
        <div className={q.isPlaceholderData ? "opacity-60" : ""}>
          <ActivityList rows={q.data.rows} showUser emptyText="No tool runs match these filters." />
          <Pagination
            page={page}
            total={q.data.total}
            pageSize={ACTIVITY_PAGE_SIZE}
            onChange={(p) => update({ page: String(p) })}
          />
        </div>
      )}
    </>
  );
}
