export type FeatureType =
  | "shame_detector"
  | "tone_breakdown"
  | "tone_adjuster"
  | "translator"
  | "generate_response";

export const FEATURE_TYPES: FeatureType[] = [
  "shame_detector",
  "tone_breakdown",
  "tone_adjuster",
  "translator",
  "generate_response",
];

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
  active_users_7d: number;
  active_users_30d: number;
  runs_7d: number;
  runs_30d: number;
  signups_by_day: DayCount[];
  runs_by_day: { day: string; platform: string; count: number }[];
  runs_by_tool: { feature_type: string; count: number }[];
}

export interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  run_count: number;
  is_admin: boolean;
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
