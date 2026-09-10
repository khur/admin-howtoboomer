import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { pivotRunsByDay, platformColor, platformKeys, shortDay, type RunsByDayRow } from "@/lib/chart-data";
import { platformLabel } from "@/lib/format";
import { AXIS_LINE, AXIS_TICK, CHART_HEIGHT, GRID_STROKE, TOOLTIP_STYLE } from "./chart-theme";

export function RunsByDayChart({ data, from, to }: { data: RunsByDayRow[]; from: string; to: string }) {
  const keys = platformKeys(data);
  const rows = pivotRunsByDay(data, { from, to });
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={(d) => shortDay(String(d))} />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 13, color: "#4a453f" }} />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            name={platformLabel(k)}
            stackId="runs"
            fill={platformColor(k)}
            stroke="#fbf9f4"
            strokeWidth={1}
            radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
