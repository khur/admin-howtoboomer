export type FeatureType =
  | "shame_detector"
  | "tone_breakdown"
  | "tone_adjuster"
  | "translator"
  | "generate_response"
  | "neutralizer";

export const FEATURE_TYPES: FeatureType[] = [
  "shame_detector",
  "tone_breakdown",
  "tone_adjuster",
  "translator",
  "generate_response",
  "neutralizer",
];

export const RUN_STATUSES = ["ok", "error", "rate_limited"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

/** Values written by the loggers (`web`, `ios`, `android`) plus `unknown` for untagged rows. */
export const PLATFORMS = ["web", "ios", "android", "unknown"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface DayCount {
  day: string;
  count: number;
}

export interface Stats {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  /** Signed-in users who ran a tool. */
  active_users_7d: number;
  active_users_30d: number;
  /** Everyone who ran a tool; anonymous visitors counted by hashed IP. */
  visitors_7d: number;
  visitors_30d: number;
  runs_7d: number;
  runs_30d: number;
  runs_total: number;
  anon_runs_30d: number;
  errors_30d: number;
  saved_7d: number;
  saved_30d: number;
  saved_total: number;
  signups_by_day: DayCount[];
  runs_by_day: { day: string; platform: string; count: number }[];
  runs_by_tool: { feature_type: string; count: number }[];
  runs_by_page: { page: string; platform: string; count: number }[];
  saved_by_tool: { feature_type: string; count: number }[];
}

export interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  /** Saved results (user_activity_history). */
  run_count: number;
  /** Successful AI calls (tool_runs). */
  tool_runs: number;
  last_run_at: string | null;
  is_admin: boolean;
}

/** One AI call, from tool_runs. */
export interface ToolRun {
  id: string;
  created_at: string;
  feature: string;
  platform: string;
  page: string | null;
  status: string;
  duration_ms: number | null;
  user_id?: string | null;
  email?: string | null;
  visitor_hash?: string | null;
}

export interface ActivityRow {
  id: string;
  created_at: string;
  feature_type: string;
  platform: string;
  input_text: string;
  output_json: unknown;
  metadata?: unknown;
  user_id?: string;
  email?: string | null;
}

export interface Page<T> {
  rows: T[];
  total: number;
}

export type SortDir = "asc" | "desc";
export interface Sort {
  by: string;
  dir: SortDir;
}
