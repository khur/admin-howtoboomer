import type { ReactNode } from "react";

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-lg">{title}</h2>
      {subtitle && <p className="text-sm text-muted mb-3">{subtitle}</p>}
      {children}
    </section>
  );
}
