import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { Skeleton } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { TypeBadge } from '@/components/TypeBadge';
import {
  useCancelUsage,
  useUsageDetail,
} from '@/features/department/hooks';
import type { UsageStatusHistoryRow } from '@/features/department/api';
import type { Status } from '@/lib/rbac';

const formatDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString() : '—';

const Field = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="grid gap-0.5">
    <span className="text-[11px] uppercase tracking-[0.04em] text-hint">
      {label}
    </span>
    <span className="text-[13px] text-text">{value}</span>
  </div>
);

const HistoryRow = ({ h }: { h: UsageStatusHistoryRow }) => (
  <li className="relative flex gap-3 pb-4 pl-5 last:pb-0">
    <span className="absolute left-1 top-1.5 h-2 w-2 rounded-full bg-text" />
    <span className="absolute left-[7px] top-3 bottom-0 w-px bg-border-default last:hidden" />
    <div className="flex-1">
      <p className="text-[13px] text-text">
        {h.from_status ? (
          <>
            <StatusPill status={h.from_status} /> →{' '}
            <StatusPill status={h.to_status} />
          </>
        ) : (
          <StatusPill status={h.to_status} />
        )}
      </p>
      <p className="mt-0.5 text-[11px] text-muted">
        {formatDateTime(h.changed_at)}
        {h.changed_by_name ? ` · ${h.changed_by_name}` : ''}
      </p>
      {h.comment && (
        <p className="mt-1 text-[12px] text-muted">{h.comment}</p>
      )}
    </div>
  </li>
);

export const RequestDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, isLoading, error } = useUsageDetail(id);
  const cancel = useCancelUsage();

  const onCancel = () => {
    if (!id || !confirm('Cancel this request?')) return;
    cancel.mutate(id, {
      onSuccess: () => {
        toast.success('Request cancelled');
        navigate('/my/requests');
      },
      onError: (e) =>
        toast.error(e instanceof Error ? e.message : 'Cancel failed'),
    });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/my/requests"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted hover:text-text"
      >
        <ArrowLeft size={12} /> Back to My Requests
      </Link>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-32 w-full rounded" />
          <Skeleton className="h-48 w-full rounded" />
        </div>
      )}

      {error instanceof ApiError && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-[13px] text-danger">
          {error.message}
        </div>
      )}

      {data && (
        <>
          <div className="mb-4 rounded-lg border border-border-default bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold text-text">
                  {data.usage.sign?.canonical_name ?? 'Sign request'}
                </h1>
                <div className="mt-1 flex items-center gap-2">
                  <StatusPill status={data.usage.status as Status} />
                  {data.usage.sign?.sign_type?.name && (
                    <TypeBadge type={data.usage.sign.sign_type.name} />
                  )}
                </div>
              </div>
              {data.usage.status === 'pending' && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={cancel.isPending}
                  className="inline-flex items-center gap-1 rounded-sm border border-border-strong px-2.5 py-1.5 text-[12px] text-danger transition hover:bg-danger-bg disabled:opacity-50"
                >
                  <X size={12} /> Cancel Request
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Event" value={data.usage.event?.name ?? '—'} />
              <Field label="Venue" value={data.usage.venue?.name ?? '—'} />
              <Field label="Zone" value={data.usage.zone?.name ?? '—'} />
              <Field
                label="Department"
                value={data.usage.department?.name ?? '—'}
              />
              <Field label="Size" value={data.usage.size?.label ?? '—'} />
              <Field label="Quantity" value={data.usage.qty} />
              <Field
                label="Submitted"
                value={formatDateTime(data.usage.submitted_at)}
              />
              <Field
                label="Created"
                value={formatDateTime(data.usage.created_at)}
              />
            </div>

            {data.usage.notes && (
              <div className="mt-4 border-t border-border-default pt-3">
                <Field label="Notes" value={data.usage.notes} />
              </div>
            )}
            {data.usage.rejection_note && (
              <div className="mt-3 rounded-md border border-danger-border bg-danger-bg p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-danger">
                  Rejection note
                </p>
                <p className="mt-0.5 text-[13px] text-danger">
                  {data.usage.rejection_note}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border-default bg-card p-5">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">
              Status History
            </h2>
            {data.history.length === 0 ? (
              <p className="text-[12px] text-muted">No status changes yet.</p>
            ) : (
              <ul className="relative">
                {data.history.map((h) => (
                  <HistoryRow key={h.id} h={h} />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};
