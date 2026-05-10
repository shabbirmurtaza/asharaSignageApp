import { Link, useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/stores/toast';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from '@/components/StatusPill';
import {
  useCancelUsage,
  useMyRequests,
} from '@/features/department/hooks';
import type { UsageRow } from '@/features/department/api';

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString() : '—';

interface RowProps {
  row: UsageRow;
  onOpen: (id: string) => void;
  onCancel: (id: string) => void;
  cancelling: boolean;
}

const RequestRow = ({ row, onOpen, onCancel, cancelling }: RowProps) => {
  const canCancel = row.status === 'pending';
  return (
    <tr
      className="cursor-pointer border-t border-border-default transition hover:bg-surface"
      onClick={() => onOpen(row.id)}
    >
      <td className="px-4 py-2.5 font-medium text-text">
        {row.sign?.canonical_name ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-muted">{row.department?.name ?? '—'}</td>
      <td className="px-4 py-2.5 text-muted">{row.size?.label ?? '—'}</td>
      <td className="px-4 py-2.5 text-muted">{row.qty}</td>
      <td className="px-4 py-2.5">
        <StatusPill status={row.status} />
      </td>
      <td className="px-4 py-2.5 text-muted">{formatDate(row.created_at)}</td>
      <td className="px-4 py-2.5 text-right">
        {canCancel && (
          <button
            type="button"
            disabled={cancelling}
            onClick={(e) => {
              e.stopPropagation();
              onCancel(row.id);
            }}
            className="inline-flex items-center gap-1 rounded-sm border border-border-strong px-2 py-1 text-[12px] text-danger transition hover:bg-danger-bg disabled:opacity-50"
          >
            <X size={12} /> Cancel
          </button>
        )}
      </td>
    </tr>
  );
};

export const MyRequestsPage = () => {
  const session = useAuth((s) => s.session);
  const userId = session?.userId;
  const navigate = useNavigate();
  const toast = useToast();

  const { data, isLoading, error } = useMyRequests(userId);
  const cancel = useCancelUsage();

  const onCancel = (id: string) => {
    if (!confirm('Cancel this request? This cannot be undone.')) return;
    cancel.mutate(id, {
      onSuccess: () => toast.success('Request cancelled'),
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : 'Cancel failed'),
    });
  };

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">My Requests</h1>
          <p className="text-[13px] text-muted">
            Signs you have submitted as Department HOD.
          </p>
        </div>
        <Link
          to="/my/requests/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-text px-3 text-[13px] font-medium text-white transition hover:opacity-90"
        >
          <Plus size={14} /> New Request
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
        </div>
      )}

      {error instanceof ApiError && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-[13px] text-danger">
          {error.message}
        </div>
      )}

      {data && data.length === 0 && (
        <EmptyState
          title="No requests yet"
          body="Submit your first sign request to get started."
          action={
            <Link
              to="/my/requests/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-sm bg-text px-3 text-[13px] font-medium text-white"
            >
              <Plus size={14} /> New Request
            </Link>
          }
        />
      )}

      {data && data.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-border-default bg-card sm:block">
            <table className="w-full text-[13px]">
              <thead className="bg-surface text-[11px] uppercase tracking-[0.04em] text-muted">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Sign</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Department</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Size</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Qty</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Created</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <RequestRow
                    key={row.id}
                    row={row}
                    cancelling={cancel.isPending}
                    onOpen={(id) => navigate(`/my/requests/${id}`)}
                    onCancel={onCancel}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 sm:hidden">
            {data.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => navigate(`/my/requests/${row.id}`)}
                className="flex w-full flex-col gap-1.5 rounded-lg border border-border-default bg-card p-3 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[14px] font-medium text-text">
                    {row.sign?.canonical_name ?? '—'}
                  </span>
                  <StatusPill status={row.status} />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span>Dept: {row.department?.name ?? '—'}</span>
                  <span>Size: {row.size?.label ?? '—'}</span>
                  <span>Qty: {row.qty}</span>
                  <span>{formatDate(row.created_at)}</span>
                </div>
                {row.status === 'pending' && (
                  <button
                    type="button"
                    disabled={cancel.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel(row.id);
                    }}
                    className="mt-1 inline-flex w-fit items-center gap-1 rounded-sm border border-border-strong px-2 py-1 text-[12px] text-danger disabled:opacity-50"
                  >
                    <X size={12} /> Cancel
                  </button>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
