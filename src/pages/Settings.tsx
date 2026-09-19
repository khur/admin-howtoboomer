import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSettings, saveSettings } from "@/lib/api";
import type { SettingsPatch } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { ErrorBlock } from "@/components/ErrorBlock";

type Key = keyof SettingsPatch;

const FIELDS: { key: Key; label: string; help: string }[] = [
  {
    key: "anon_daily_limit",
    label: "Free runs per day (not signed in)",
    help: "Per visitor IP, resets at midnight UTC. After this the site asks them to sign up.",
  },
  {
    key: "user_daily_limit",
    label: "Runs per day (signed in)",
    help: "Default per account, web and app. Override one user from their page.",
  },
  {
    key: "ip_minute_limit",
    label: "Runs per minute per IP",
    help: "Burst protection. Applies to everyone.",
  },
  {
    key: "global_daily_limit",
    label: "Runs per day, everyone combined",
    help: "Hard cost ceiling across the whole site and app.",
  },
];

const EMPTY: Record<Key, string> = {
  anon_daily_limit: "",
  user_daily_limit: "",
  ip_minute_limit: "",
  global_daily_limit: "",
};

export function Settings() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["settings"], queryFn: getSettings });
  const [form, setForm] = useState<Record<Key, string>>(EMPTY);

  useEffect(() => {
    if (q.data) {
      setForm({
        anon_daily_limit: String(q.data.anon_daily_limit),
        user_daily_limit: String(q.data.user_daily_limit),
        ip_minute_limit: String(q.data.ip_minute_limit),
        global_daily_limit: String(q.data.global_daily_limit),
      });
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: (patch: SettingsPatch) => saveSettings(patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Limits saved. They apply from the next request.");
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isPending) return <Spinner label="Loading limits…" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  const parsed = Object.fromEntries(
    FIELDS.map((f) => [f.key, Number.parseInt(form[f.key], 10)]),
  ) as Record<Key, number>;
  const valid = FIELDS.every((f) => Number.isInteger(parsed[f.key]) && parsed[f.key] >= 0);
  const dirty = FIELDS.some((f) => parsed[f.key] !== q.data[f.key]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (valid && dirty) save.mutate(parsed);
  }

  return (
    <>
      <PageHeader
        title="Limits"
        subtitle={<>Rate limits for the AI tools. Last changed {formatDateTime(q.data.updated_at)}.</>}
      />
      <form onSubmit={onSubmit} className="card p-5 space-y-5 max-w-xl">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="label">
              {f.label}
            </label>
            <input
              id={f.key}
              className="field"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            />
            <p className="text-xs text-muted mt-1">{f.help}</p>
          </div>
        ))}
        {!valid && <p className="text-sm text-error">Every limit must be a whole number, 0 or more.</p>}
        <button type="submit" className="btn btn-primary" disabled={!valid || !dirty || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </button>
      </form>
    </>
  );
}
