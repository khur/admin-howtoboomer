import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { getStats } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { ChartCard } from "@/components/ChartCard";
import { Spinner } from "@/components/Spinner";
import { ErrorBlock } from "@/components/ErrorBlock";
import { PlatformBadge } from "@/components/PlatformBadge";
import { SignupsChart } from "@/components/charts/SignupsChart";
import { RunsByDayChart } from "@/components/charts/RunsByDayChart";
import { RunsByToolChart } from "@/components/charts/RunsByToolChart";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function Empty({ text }: { text: string }) {
  return <p className="text-muted py-10 text-center">{text}</p>;
}

export function Dashboard() {
  const q = useQuery({ queryKey: ["stats"], queryFn: getStats });

  if (q.isPending) return <Spinner label="Loading stats…" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  const s = q.data;
  const to = isoDay(new Date());
  const from = isoDay(new Date(Date.now() - 29 * 86_400_000));
  const anonShare = s.runs_30d ? Math.round((s.anon_runs_30d / s.runs_30d) * 100) : 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Signups and tool usage across web and the iOS app." />

      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">People</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total users" value={s.total_users} />
        <StatTile label="New users" value={s.new_users_7d} hint={`last 7 days · ${s.new_users_30d} in 30`} />
        <StatTile label="Active users" value={s.active_users_7d} hint={`signed in, ran a tool · ${s.active_users_30d} in 30`} />
        <StatTile label="Visitors" value={s.visitors_7d} hint={`anyone who ran a tool · ${s.visitors_30d} in 30`} />
      </div>

      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">Usage</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="Tool runs" value={s.runs_7d} hint={`last 7 days · ${s.runs_30d} in 30`} />
        <StatTile label="Anonymous share" value={anonShare} hint={`% of runs in 30 days by signed-out visitors`} />
        <StatTile label="Errors" value={s.errors_30d} hint="failed or rate-limited, last 30 days" />
        <StatTile label="Saved results" value={s.saved_7d} hint={`last 7 days · ${s.saved_30d} in 30 · ${s.saved_total} ever`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Tool runs by platform" subtitle="Successful AI calls per day, last 30 days">
          {s.runs_by_day.length ? (
            <RunsByDayChart data={s.runs_by_day} from={from} to={to} />
          ) : (
            <Empty text="No runs in the last 30 days." />
          )}
        </ChartCard>
        <ChartCard title="Signups" subtitle="New accounts per day, last 30 days">
          {s.signups_by_day.some((d) => d.count > 0) ? (
            <SignupsChart data={s.signups_by_day} />
          ) : (
            <Empty text="No signups in the last 30 days." />
          )}
        </ChartCard>
        <ChartCard title="Runs by tool" subtitle={`All time · ${formatNumber(s.runs_total)} total`}>
          {s.runs_by_tool.length ? <RunsByToolChart data={s.runs_by_tool} /> : <Empty text="No runs yet." />}
        </ChartCard>
        <ChartCard title="Where tools are run" subtitle="Top pages, last 30 days">
          {s.runs_by_page.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge text-left">
                  <th scope="col" className="py-2 pr-3 font-semibold">Page</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Platform</th>
                  <th scope="col" className="py-2 font-semibold text-right">Runs</th>
                </tr>
              </thead>
              <tbody>
                {s.runs_by_page.map((r) => (
                  <tr key={`${r.page}|${r.platform}`} className="border-b border-hairline last:border-b-0">
                    <td className="py-2 pr-3 font-mono text-xs break-all">{r.page}</td>
                    <td className="py-2 pr-3"><PlatformBadge platform={r.platform} /></td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(r.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty text="No runs yet." />
          )}
          <p className="text-xs text-muted mt-3">
            Mobile runs have no page — the tool is the screen. Full list on <Link to="/runs" className="underline">Runs</Link>.
          </p>
        </ChartCard>
        <ChartCard title="Saved results by tool" subtitle="All time — what people chose to keep">
          {s.saved_by_tool.length ? <RunsByToolChart data={s.saved_by_tool} /> : <Empty text="Nothing saved yet." />}
        </ChartCard>
      </div>
    </>
  );
}
