import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LayoutGrid, List, Search } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { TypeBadge, type SignType } from '@/components/TypeBadge';
import { useAuth } from '@/lib/auth';
import { myDepartmentId } from '@/lib/rbac';
import { useSigns, useSignTypes } from '@/features/library/hooks';
import { useDepartments } from '@/features/hod/hooks';
import type { VariableFilter } from '@/features/library/api';

const VARIABLE_OPTIONS: { value: VariableFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'constant', label: 'Constant' },
  { value: 'variable', label: 'Variable' },
];

const TYPE_RAIL: Record<SignType, string> = {
  prohibition: '#A32D2D',
  mandatory: '#185FA5',
  warning: '#BA7517',
  safe_condition: '#3B6D11',
  direction: '#185FA5',
  place: '#0F6E56',
  notice: '#534AB7',
};

type ViewMode = 'grid' | 'list';
const VIEW_KEY = 'signLibrary.viewMode';
const PAGE_SIZE_KEY = 'signLibrary.pageSize';
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

const useDebounced = <T,>(value: T, ms = 250): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};

export const SignLibraryPage = () => {
  const session = useAuth((s) => s.session);
  const isDeptUser = session?.primaryRole === 'department_user';
  const lockedDeptId = isDeptUser ? myDepartmentId(session) : null;

  const [selectedTypes, setSelectedTypes] = useState<SignType[]>([]);
  const [variable, setVariable] = useState<VariableFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const search = useDebounced(searchInput, 250);

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'grid';
    const stored = window.localStorage.getItem(VIEW_KEY);
    return stored === 'list' ? 'list' : 'grid';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_KEY, view);
    }
  }, [view]);

  const { data: types } = useSignTypes();
  const { data: departments } = useDepartments();
  const effectiveDeptId = lockedDeptId ?? (departmentId || undefined);

  const filters = useMemo(
    () => ({
      signTypeNames: selectedTypes,
      variable,
      search,
      departmentId: effectiveDeptId,
    }),
    [selectedTypes, variable, search, effectiveDeptId],
  );
  const { data: signs, isLoading, isError } = useSigns(filters);

  const [pageSize, setPageSize] = useState<PageSize>(() => {
    if (typeof window === 'undefined') return 24;
    const stored = Number(window.localStorage.getItem(PAGE_SIZE_KEY));
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(stored)
      ? (stored as PageSize)
      : 24;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
    }
  }, [pageSize]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [selectedTypes, variable, search, departmentId, pageSize]);

  const total = signs?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, total);
  const pageSigns = useMemo(
    () => signs?.slice(pageStart, pageEnd) ?? [],
    [signs, pageStart, pageEnd],
  );

  const toggleType = (name: SignType) => {
    setSelectedTypes((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-h1 text-text">Sign Library</h1>
        <p className="text-body-sm text-muted">
          {isDeptUser
            ? "Signs owned by your department."
            : 'Browse the catalogue of signs used across events.'}
        </p>
      </header>

      <section className="flex flex-col gap-3 rounded-lg border border-border-default bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {types?.map((t) => {
            const active = selectedTypes.includes(t.name);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleType(t.name)}
                className={`rounded-full border px-3 py-1 text-caption transition ${
                  active
                    ? 'border-text bg-text text-white'
                    : 'border-border-default bg-surface text-text hover:border-border-strong'
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-md border border-border-default bg-surface p-0.5">
              {VARIABLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setVariable(opt.value)}
                  className={`rounded px-3 py-1 text-caption transition ${
                    variable === opt.value
                      ? 'bg-card font-medium text-text shadow-sm'
                      : 'text-muted hover:text-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {!isDeptUser && (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="rounded-md border border-border-default bg-card px-2.5 py-1.5 text-body-sm text-text focus:border-text focus:outline-none"
              >
                <option value="">All departments</option>
                {departments?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-xs">
              <Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-hint"
              />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search canonical name…"
                className="w-full rounded-md border border-border-default bg-card py-1.5 pl-8 pr-3 text-body-sm text-text placeholder:text-hint focus:border-text focus:outline-none"
              />
            </div>

            <div
              role="group"
              aria-label="View mode"
              className="inline-flex rounded-md border border-border-default bg-surface p-0.5"
            >
              <button
                type="button"
                aria-pressed={view === 'grid'}
                aria-label="Grid view"
                onClick={() => setView('grid')}
                className={`flex h-7 w-7 items-center justify-center rounded transition ${
                  view === 'grid'
                    ? 'bg-card text-text shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                <LayoutGrid size={14} />
              </button>
              <button
                type="button"
                aria-pressed={view === 'list'}
                aria-label="List view"
                onClick={() => setView('list')}
                className={`flex h-7 w-7 items-center justify-center rounded transition ${
                  view === 'list'
                    ? 'bg-card text-text shadow-sm'
                    : 'text-muted hover:text-text'
                }`}
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {isLoading && (view === 'grid' ? <SignGridSkeleton /> : <SignListSkeleton />)}

      {isError && (
        <EmptyState
          title="Could not load signs"
          body="Check your connection and refresh."
        />
      )}

      {!isLoading && !isError && (signs?.length ?? 0) === 0 && (
        <EmptyState
          title="No signs match"
          body="Try removing filters or clearing the search."
        />
      )}

      {!isLoading && signs && signs.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageSigns.map((s) => {
            const rail = TYPE_RAIL[s.sign_type as SignType] ?? '#1F1F1D';
            return (
              <Link
                key={s.id}
                to={`/library/${s.id}`}
                className="group relative flex flex-col gap-2 overflow-hidden rounded-lg border border-border-default bg-card p-4 pt-[18px] transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-[3px]"
                  style={{ background: rail }}
                />
                <div className="flex items-start justify-between gap-2">
                  <TypeBadge type={s.sign_type} />
                  <span className="text-caption text-hint">
                    used {s.total_orders}×
                  </span>
                </div>
                <span className="inline-flex w-fit items-center rounded-full border border-border-default bg-surface px-2 py-0.5 text-caption text-muted">
                  {s.department_name}
                </span>
                <p className="text-body font-medium text-text line-clamp-2">
                  {s.canonical_name}
                </p>
                {s.description_lisan && (
                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-body-sm text-muted line-clamp-2"
                  >
                    {s.description_lisan}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between border-t border-border-default pt-2 text-caption text-hint">
                  <span>{s.template_id ? 'Variable' : 'Constant'}</span>
                  <span>qty {s.total_qty_all_time}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!isLoading && signs && signs.length > 0 && view === 'list' && (
        <div className="overflow-hidden rounded-lg border border-border-default bg-card">
          <table className="w-full text-body-sm">
            <thead className="border-b border-border-default bg-surface text-caption uppercase text-hint">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Name</th>
                <th className="px-3 py-2 text-left font-medium">Department</th>
                <th className="px-3 py-2 text-left font-medium">Kind</th>
                <th className="px-3 py-2 text-right font-medium">Used</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
              </tr>
            </thead>
            <tbody>
              {pageSigns.map((s) => {
                const rail = TYPE_RAIL[s.sign_type as SignType] ?? '#1F1F1D';
                return (
                  <tr
                    key={s.id}
                    className="group border-b border-border-default last:border-0 hover:bg-surface"
                  >
                    <td className="px-3 py-2">
                      <Link
                        to={`/library/${s.id}`}
                        className="flex items-center gap-2"
                      >
                        <span
                          aria-hidden
                          className="inline-block h-3 w-[3px] rounded"
                          style={{ background: rail }}
                        />
                        <TypeBadge type={s.sign_type} />
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/library/${s.id}`}
                        className="block font-medium text-text group-hover:underline"
                      >
                        {s.canonical_name}
                      </Link>
                      {s.description_lisan && (
                        <span
                          dir="rtl"
                          lang="ar"
                          className="font-arabic text-caption text-muted"
                        >
                          {s.description_lisan}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {s.department_name}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {s.template_id ? 'Variable' : 'Constant'}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {s.total_orders}×
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {s.total_qty_all_time}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-card px-3 py-2 text-body-sm text-muted">
          <div className="flex items-center gap-2">
            <span>
              {pageStart + 1}–{pageEnd} of {total}
            </span>
            <label className="flex items-center gap-1.5 text-caption">
              <span className="text-hint">per page</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
                className="rounded border border-border-default bg-card px-1.5 py-0.5 text-body-sm text-text focus:border-text focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-border-default bg-surface text-text transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-caption text-text">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex h-7 w-7 items-center justify-center rounded border border-border-default bg-surface text-text transition hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SignGridSkeleton = () => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <div
        key={i}
        className="flex flex-col gap-2 rounded-lg border border-border-default bg-card p-4"
      >
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    ))}
  </div>
);

const SignListSkeleton = () => (
  <div className="flex flex-col gap-1 rounded-lg border border-border-default bg-card p-2">
    {Array.from({ length: 8 }).map((_, i) => (
      <Skeleton key={i} className="h-8 w-full" />
    ))}
  </div>
);
