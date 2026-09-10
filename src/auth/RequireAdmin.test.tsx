import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import type { AuthState } from "./AuthProvider";

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("./AuthProvider", () => ({ useAuth }));

import { RequireAdmin } from "./RequireAdmin";

function renderAt(state: Partial<AuthState>) {
  useAuth.mockReturnValue({
    session: null,
    isAdmin: null,
    loading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    ...state,
  });
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route
          path="/"
          element={
            <RequireAdmin>
              <p>secret</p>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const session = { user: { id: "u1", email: "a@b.com" } } as unknown as AuthState["session"];

describe("RequireAdmin", () => {
  it("shows a loading state while auth resolves", () => {
    renderAt({ loading: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });
  it("redirects to /login without a session", () => {
    renderAt({ session: null });
    expect(screen.getByText("login page")).toBeInTheDocument();
  });
  it("blocks signed-in non-admins", () => {
    renderAt({ session, isAdmin: false });
    expect(screen.getByText(/not authorized/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });
  it("renders children for admins", () => {
    renderAt({ session, isAdmin: true });
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});
