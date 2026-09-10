// Shared Recharts props so the three dashboard charts read as one system:
// recessive grid/axes in muted ink, text in text tokens (never series color).

export const AXIS_TICK = { fill: "#6a635b", fontSize: 12, fontFamily: "Nunito, sans-serif" };
export const AXIS_LINE = { stroke: "#ddd6c9" };
export const GRID_STROKE = "#e6e0d4";
export const BRICK = "#b8321f";
export const CHART_HEIGHT = 260;

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "#fbf9f4",
    border: "1px solid #8c8478",
    borderRadius: 0,
    fontFamily: "Nunito, sans-serif",
    fontSize: 13,
    color: "#332f2b",
  },
  labelStyle: { color: "#332f2b", fontWeight: 600 },
  itemStyle: { color: "#4a453f" },
  cursor: { fill: "rgba(140, 132, 120, 0.12)" },
};
