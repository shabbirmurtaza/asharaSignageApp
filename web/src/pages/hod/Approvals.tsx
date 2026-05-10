/**
 * Pending-approvals queue grouped by department, with bulk-approve and
 * per-row reject. Visibility is venue-scoped via RLS; we just supply the
 * (event, venue) filter.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/stores/toast';
import {
  useBulkApprove,
  useVenue,
  useVenuePending,
} from '@/features/hod/hooks';
import type { HodUsageRow } from '@/features/hod/api';
import { useHodScope } from '@/features/hod/scope';
import { RejectModal } from '@/features/hod/RejectModal';

interface DeptGroup {
  name: string;
  nameLisan: string | null;
  rows: HodUsageRow[];
}

const groupByDept = (rows: HodUsageRow[]): DeptGroup[] => {
  const map = new Map<string, DeptGroup>();
  for (const r of rows) {
    const name = r.department?.name ?? 'Unknown';
    const existing = map.get(name);
    if (existing) {
      existing.rows.push(r);
    } else {
      map.set(name, {
        name,
        nameLisan: r.department?.name_lisan ?? null,
        rows: [r],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const HodApprovalsPage = () => {
  const toast = useToast();
  const { active, hasScope } = useHodScope();
  const venue = useVenue(active?.venueId);
  const pending = useVenuePending(active?.eventId, active?.venueId);
  const bulk = useBulkApprove(active?.eventId, active?.venueId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<HodUsageRow | null>(null);

  const groups = useMemo(
    () => groupByDept(pending.data ?? []),
    [pending.data],
  );

  if (!hasScope) {
    return <EmptyState title="No HOD venue assigned" />;
  }
  if (!active) return null;

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleGroup = (rows: HodUsageRow[], allSelected: boolean) => {
    setSelected((s) => {
      const n = new Set(s);
      if (allSelected) {
        rows.forEach((r) => n.delete(r.id));
      } else {
        rows.forEach((r) => n.add(r.id));
      }
      return n;
    });
  };

  const onBulkApprove = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      await bulk.mutateAsync(ids);
      toast.success(`Approved ${ids.length} request${ids.length === 1 ? '' : 's'}`);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Bulk approve failed');
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-h1 text-text">Approvals</h1>
          <p className="text-body-sm text-muted">
            Pending requests at {venue.data?.name ?? '—'}
          </p>
        </div>
        <button
          disabled={selected.size === 0 || bulk.isPending}
          onClick={onBulkApprove}
          className="h-8 rounded-sm bg-text px-3 text-body-sm font-medium text-white disabled:opacity-50"
        >
          {bulk.isPending ? 'Approving…' : `Approve selected (${selected.size})`}
        </button>
      </div>

      {pending.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded" />
          ))}
        </div>
      )}
      {pending.error instanceof ApiError && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-body-sm text-danger">
          {pending.error.message}
        </div>
      )}
      {pending.data && pending.data.length === 0 && (
        <EmptyState title={`No pending requests at ${venue.data?.name ?? 'this venue'}`} />
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <DeptCard
            key={g.name}
            group={g}
            selected={selected}
            onToggle={toggle}
            onToggleGroup={toggleGroup}
            onReject={setRejecting}
          />
        ))}
      </div>

      {rejecting && (
        <RejectModal
          usageId={rejecting.id}
          signLabel={`${rejecting.sign?.canonical_name ?? 'Sign'} × ${rejecting.qty}`}
          eventId={active.eventId}
          venueId={active.venueId}
          onClose={() => setRejecting(null)}
        />
      )}
    </div>
  );
};

interface DeptCardProps {
  group: DeptGroup;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleGroup: (rows: HodUsageRow[], allSelected: boolean) => void;
  onReject: (row: HodUsageRow) => void;
}

const DeptCard = ({
  group,
  selected,
  onToggle,
  onToggleGroup,
  onReject,
}: DeptCardProps) => {
  const [open, setOpen] = useState(true);
  const allSelected = group.rows.every((r) => selected.has(r.id));
  const someSelected = !allSelected && group.rows.some((r) => selected.has(r.id));
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div className="overflow-hidden rounded-lg border border-border-default bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border-default bg-surface px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left focus:outline-none"
        >
          <Chevron size={14} className="text-muted" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-h3 text-text">{group.name}</span>
              {group.nameLisan && (
                <span
                  dir="rtl"
                  lang="ar"
                  className="font-arabic text-meta text-muted"
                >
                  {group.nameLisan}
                </span>
              )}
            </div>
          </div>
          <span className="ml-auto inline-flex h-6 items-center rounded-full bg-tertiary px-2 text-caption font-medium text-muted">
            {group.rows.length} pending
          </span>
        </button>
        <label className="flex items-center gap-2 text-meta text-muted">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={() => onToggleGroup(group.rows, allSelected)}
            aria-label={`Select all ${group.rows.length} requests for ${group.name}`}
          />
          <span className="hidden sm:inline">Select all</span>
        </label>
      </div>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-left text-eyebrow uppercase text-muted">
                <th className="w-10 px-3 py-2"></th>
                <th className="px-2 py-2 font-semibold">Sign</th>
                <th className="px-2 py-2 font-semibold">Qty</th>
                <th className="px-2 py-2 font-semibold">Size</th>
                <th className="px-2 py-2 font-semibold">By</th>
                <th className="px-2 py-2 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <tr key={r.id} className="border-t border-border-default">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => onToggle(r.id)}
                      aria-label={`Select ${r.sign?.canonical_name ?? 'request'} (qty ${r.qty})`}
                    />
                  </td>
                  <td className="px-2 py-2 font-medium text-text">
                    {r.sign?.canonical_name ?? '—'}
                  </td>
                  <td className="px-2 py-2 text-muted">×{r.qty}</td>
                  <td className="px-2 py-2 text-meta text-muted">
                    {r.size?.label ?? ''}
                  </td>
                  <td className="px-2 py-2 text-meta text-muted">
                    {r.created_by_user?.name ?? r.created_by_user?.its_number ?? 'unknown'}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => onReject(r)}
                      className="inline-flex h-8 items-center gap-1 rounded-sm border border-danger-border px-2 text-meta text-danger transition hover:bg-danger-bg"
                      aria-label={`Reject ${r.sign?.canonical_name ?? 'request'}`}
                    >
                      <X size={12} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
