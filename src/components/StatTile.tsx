import { formatNumber } from "@/lib/format";

export function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="font-display text-3xl font-semibold mt-1 tabular-nums">{formatNumber(value)}</p>
      {hint && <p className="text-sm text-muted mt-1">{hint}</p>}
    </div>
  );
}
