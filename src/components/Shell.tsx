import { NavLink, Outlet } from "react-router";
import { Activity, LayoutDashboard, LogOut, Users } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/users", label: "Users", icon: Users, end: false },
  { to: "/activity", label: "Activity", icon: Activity, end: false },
];

export function Shell() {
  const { session, signOut } = useAuth();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="bg-surface border-b md:border-b-0 md:border-r border-edge flex md:flex-col md:min-h-screen md:sticky md:top-0 md:h-screen">
        <div className="px-5 py-4 md:py-6 border-r md:border-r-0 md:border-b border-hairline">
          <p className="font-display font-semibold leading-tight">How to, Boomer!</p>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide">Admin</p>
        </div>
        <nav className="flex md:flex-col grow px-2 md:py-3 gap-1" aria-label="Main">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 h-12 px-3 font-semibold border-l-4 ${
                  isActive
                    ? "border-brick bg-surface-soft text-ink"
                    : "border-transparent text-body hover:bg-surface-soft"
                }`
              }
            >
              <Icon aria-hidden className="size-5" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block px-5 py-4 border-t border-hairline text-sm">
          <p className="truncate text-muted" title={session?.user.email ?? ""}>
            {session?.user.email}
          </p>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-2 font-semibold text-ink hover:text-brick"
            onClick={() => void signOut()}
          >
            <LogOut aria-hidden className="size-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="p-5 md:p-8 max-w-6xl w-full">
        <Outlet />
      </main>
    </div>
  );
}
