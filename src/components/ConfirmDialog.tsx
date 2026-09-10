import { useEffect, useRef, useState } from "react";

/**
 * Destructive-action confirm. The user must type `confirmText` exactly
 * before the confirm button enables.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmText,
  confirmLabel = "Delete",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmText: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setTyped("");
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="card p-0 w-full max-w-md backdrop:bg-black/50 m-auto"
    >
      <form
        method="dialog"
        className="p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed === confirmText && !busy) onConfirm();
        }}
      >
        <h2 className="text-xl">{title}</h2>
        <p className="text-body">{body}</p>
        <div>
          <label htmlFor="confirm-text" className="label">
            Type <span className="font-mono">{confirmText}</span> to confirm
          </label>
          <input
            id="confirm-text"
            className="field"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-danger"
            disabled={typed !== confirmText || busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
