import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { featureLabel } from "@/lib/format";
import { AXIS_LINE, AXIS_TICK, BRICK, CHART_HEIGHT, GRID_STROKE, TOOLTIP_STYLE } from "./chart-theme";

export function RunsByToolChart({ data }: { data: { feature_type: string; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: featureLabel(d.feature_type) }));
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 40, left: 8, bottom: 0 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
        <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} />
        <YAxis type="category" dataKey="label" width={130} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [v, "Runs"]} />
        <Bar dataKey="count" name="Runs" fill={BRICK} radius={[0, 4, 4, 0]} maxBarSize={22} label={{ position: "right", fill: "#4a453f", fontSize: 12 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
