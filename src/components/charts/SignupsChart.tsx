import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayCount } from "@/lib/types";
import { shortDay } from "@/lib/chart-data";
import { AXIS_LINE, AXIS_TICK, BRICK, CHART_HEIGHT, GRID_STROKE, TOOLTIP_STYLE } from "./chart-theme";

export function SignupsChart({ data }: { data: DayCount[] }) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={GRID_STROKE} />
        <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_TICK} axisLine={AXIS_LINE} tickLine={false} minTickGap={24} />
        <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
        <Tooltip {...TOOLTIP_STYLE} labelFormatter={(d) => shortDay(String(d))} formatter={(v) => [v, "Signups"]} />
        <Bar dataKey="count" name="Signups" fill={BRICK} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
