import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./AuthProvider";
import { Spinner } from "@/components/Spinner";

/**
 * Route guard. This is UX only — every RPC and policy re-checks
 * `profiles.is_admin` server-side.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Spinner label="Checking access…" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (isAdmin !== true) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="card max-w-md w-full p-8 text-center">
          <h1 className="text-2xl mb-2">Not authorized</h1>
          <p className="text-body mb-6">
            <span className="font-semibold">{session.user.email}</span> is signed in but isn't
            an admin.
          </p>
          <button type="button" className="btn" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
