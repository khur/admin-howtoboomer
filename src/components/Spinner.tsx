export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-muted py-8">
      <span
        aria-hidden
        className="inline-block size-5 border-2 border-edge border-t-brick rounded-full animate-spin"
      />
      <span>{label}</span>
    </div>
  );
}
