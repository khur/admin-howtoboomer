import { platformColor } from "@/lib/chart-data";
import { platformLabel } from "@/lib/format";

export function PlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="badge inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block size-2" style={{ background: platformColor(platform) }} />
      {platformLabel(platform)}
    </span>
  );
}
