import type { FeatureType } from "./types";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const DATETIME_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Sep 10, 2026", or "—" when missing. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DATE_FMT.format(new Date(iso));
}

/** "Sep 10, 2026, 3:04 PM" in the viewer's zone, or "—". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DATETIME_FMT.format(new Date(iso));
}

/** "just now" / "45m ago" / "3h ago" / "2d ago", a date past 30 days, "never" when missing. */
export function formatRelative(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return "never";
  const seconds = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 30) return `${days}d ago`;
  return formatDate(iso);
}

/** Same table as the mobile app's `activity.ts` — keep in sync. */
const LABELS: Record<FeatureType, string> = {
  shame_detector: "Shame Detector",
  tone_breakdown: "Tone Breakdown",
  tone_adjuster: "Tone Adjuster",
  translator: "Translator",
  generate_response: "Response Generator",
};

export function featureLabel(featureType: string): string {
  return LABELS[featureType as FeatureType] ?? featureType;
}

export function platformLabel(platform: string): string {
  switch (platform) {
    case "web":
      return "Web";
    case "ios":
      return "iOS";
    case "android":
      return "Android";
    default:
      return "Unknown";
  }
}

/** Single-line, whitespace-collapsed preview capped at `max` characters. */
export function preview(text: string, max = 80): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? flat.slice(0, max) + "…" : flat;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
