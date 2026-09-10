import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { deleteUser, getUserDetail, sendPasswordReset, updateProfile } from "@/lib/api";
import { formatDate, formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { useAuth } from "@/auth/AuthProvider";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { Spinner } from "@/components/Spinner";
import { ErrorBlock } from "@/components/ErrorBlock";
import { ActivityList } from "@/components/ActivityList";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function UserDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { session } = useAuth();

  const q = useQuery({ queryKey: ["user", id], queryFn: () => getUserDetail(id), enabled: !!id });

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (q.data) {
      setFullName(q.data.user.full_name ?? "");
      setUsername(q.data.user.username ?? "");
    }
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => updateProfile(id, { full_name: fullName.trim(), username: username.trim() }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user", id] });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Profile saved.");
    },
    onError: (e) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: (email: string) => sendPasswordReset(email),
    onSuccess: (_d, email) => toast.success(`Password reset email sent to ${email}.`),
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteUser(id),
    onSuccess: async () => {
      setConfirmOpen(false);
      queryClient.removeQueries({ queryKey: ["user", id] });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("User deleted.");
      navigate("/users", { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  if (q.isPending) return <Spinner label="Loading user…" />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;

  const { user, activity } = q.data;
  const isSelf = session?.user.id === user.user_id;
  const dirty = fullName.trim() !== (user.full_name ?? "") || username.trim() !== (user.username ?? "");

  function onSave(e: FormEvent) {
    e.preventDefault();
    if (dirty) save.mutate();
  }

  return (
    <>
      <Link to="/users" className="inline-flex items-center gap-1 text-sm font-semibold text-body hover:text-brick mb-3">
        <ArrowLeft aria-hidden className="size-4" /> All users
      </Link>
      <PageHeader
        title={
          <span className="break-all">
            {user.email}
            {user.is_admin && <span className="badge ml-3 align-middle">admin</span>}
          </span>
        }
        subtitle={
          <>
            Joined {formatDate(user.created_at)} · last sign-in {formatRelative(user.last_sign_in_at)}
            {user.last_sign_in_at && ` (${formatDateTime(user.last_sign_in_at)})`} ·{" "}
            {formatNumber(user.run_count)} tool runs
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] mb-6">
        <form onSubmit={onSave} className="card p-5 space-y-4">
          <h2 className="text-lg">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="full_name" className="label">Full name</label>
              <input id="full_name" className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="username" className="label">Username</label>
              <input id="username" className="field" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted font-mono break-all">id {user.user_id}</p>
          <button type="submit" className="btn btn-primary" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </form>

        <section className="card p-5 space-y-3">
          <h2 className="text-lg">Actions</h2>
          <button
            type="button"
            className="btn w-full"
            disabled={reset.isPending}
            onClick={() => reset.mutate(user.email)}
          >
            {reset.isPending ? "Sending…" : "Send password reset"}
          </button>
          <button
            type="button"
            className="btn btn-danger w-full"
            disabled={isSelf}
            onClick={() => setConfirmOpen(true)}
          >
            Delete user
          </button>
          {isSelf && (
            <p className="text-xs text-muted">You can't delete your own account from here — use the app.</p>
          )}
        </section>
      </div>

      <h2 className="text-lg mb-3">Activity {activity.length >= 500 && <span className="text-sm text-muted">(latest 500)</span>}</h2>
      <ActivityList rows={activity} emptyText="This user hasn't run a tool yet." />

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this user?"
        body="This permanently removes the account, its profile, avatar and all tool history. It cannot be undone."
        confirmText={user.email}
        confirmLabel="Delete user"
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
