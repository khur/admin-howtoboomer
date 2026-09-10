import { useQuery } from "@tanstack/react-query";
import { getStats } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { ChartCard } from "@/components/ChartCard";
import { Spinner } from "@/components/Spinner";
import { ErrorBlock } from "@/components/ErrorBlock";
import { SignupsChart } from "@/components/charts/SignupsChart";
import { RunsByDayChart } from "@/components/charts/RunsByDayChart";
import { RunsByToolChart } from "@/components/charts/RunsByToolChart";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function Dashboard() {
  const q = useQuery({ queryKey: ["stats"], queryFn: getStats });

  if (q.isPending) return <Spinner label="Loading stats…" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  const s = q.data;
  const to = isoDay(new Date());
  const from = isoDay(new Date(Date.now() - 29 * 86_400_000));
  const totalRuns = s.runs_by_tool.reduce((n, t) => n + t.count, 0);

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Signups and tool usage across web and the iOS app." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatTile label="Total users" value={s.total_users} />
        <StatTile label="New users" value={s.new_users_7d} hint={`last 7 days · ${s.new_users_30d} in 30`} />
        <StatTile label="Active users" value={s.active_users_7d} hint={`last 7 days · ${s.active_users_30d} in 30`} />
        <StatTile label="Tool runs" value={s.runs_7d} hint={`last 7 days · ${s.runs_30d} in 30`} />
        <StatTile label="Tool runs, all time" value={totalRuns} />
        <StatTile
          label="Runs per active user"
          value={s.active_users_30d ? Math.round((s.runs_30d / s.active_users_30d) * 10) / 10 : 0}
          hint="last 30 days"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Signups" subtitle="New accounts per day, last 30 days">
          {s.signups_by_day.some((d) => d.count > 0) ? (
            <SignupsChart data={s.signups_by_day} />
          ) : (
            <p className="text-muted py-10 text-center">No signups in the last 30 days.</p>
          )}
        </ChartCard>
        <ChartCard title="Tool runs by platform" subtitle="Per day, last 30 days. “Unknown” = rows logged before platform tagging.">
          {s.runs_by_day.length ? (
            <RunsByDayChart data={s.runs_by_day} from={from} to={to} />
          ) : (
            <p className="text-muted py-10 text-center">No tool runs in the last 30 days.</p>
          )}
        </ChartCard>
        <ChartCard title="Runs by tool" subtitle="All time">
          {s.runs_by_tool.length ? (
            <RunsByToolChart data={s.runs_by_tool} />
          ) : (
            <p className="text-muted py-10 text-center">No data yet.</p>
          )}
        </ChartCard>
      </div>
    </>
  );
}
