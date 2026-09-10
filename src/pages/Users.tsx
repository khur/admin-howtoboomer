import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { listUsers, USERS_PAGE_SIZE } from "@/lib/api";
import type { AdminUser } from "@/lib/types";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { useDebounce } from "@/lib/use-debounce";
import { PageHeader } from "@/components/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { ErrorBlock } from "@/components/ErrorBlock";
import { Spinner } from "@/components/Spinner";

const COLUMNS: Column<AdminUser>[] = [
  {
    key: "email",
    header: "Email",
    render: (u) => (
      <span className="font-semibold text-ink">
        {u.email}
        {u.is_admin && <span className="badge ml-2">admin</span>}
      </span>
    ),
  },
  { key: "name", header: "Name", render: (u) => u.full_name || <span className="text-muted">—</span> },
  { key: "joined", header: "Joined", render: (u) => formatDate(u.created_at) },
  { key: "seen", header: "Last sign-in", render: (u) => formatRelative(u.last_sign_in_at) },
  { key: "runs", header: "Runs", className: "text-right tabular-nums", render: (u) => formatNumber(u.run_count) },
];

export function Users() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const [search, setSearch] = useState(params.get("q") ?? "");
  const debounced = useDebounce(search);

  const q = useQuery({
    queryKey: ["users", debounced, page],
    queryFn: () => listUsers(debounced, page),
    placeholderData: keepPreviousData,
  });

  function setPage(p: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
  }

  function onSearch(value: string) {
    setSearch(value);
    const next = new URLSearchParams(params);
    if (value) next.set("q", value);
    else next.delete("q");
    next.delete("page");
    setParams(next, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={q.data ? `${formatNumber(q.data.total)} accounts` : undefined}
      />

      <div className="relative mb-4 max-w-md">
        <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted" />
        <input
          type="search"
          aria-label="Search users by email or name"
          placeholder="Search by email or name"
          className="field pl-10"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      {q.isPending && <Spinner label="Loading users…" />}
      {q.isError && <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />}
      {q.data && (
        <div className={q.isPlaceholderData ? "opacity-60" : ""}>
          <DataTable
            columns={COLUMNS}
            rows={q.data.rows}
            rowKey={(u) => u.user_id}
            onRowClick={(u) => navigate(`/users/${u.user_id}`)}
            emptyText={debounced ? `No users match “${debounced}”.` : "No users yet."}
          />
          <Pagination page={page} total={q.data.total} pageSize={USERS_PAGE_SIZE} onChange={setPage} />
        </div>
      )}
    </>
  );
}
