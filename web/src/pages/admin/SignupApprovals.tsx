import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronLeft, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { usePendingSignups } from '@/features/admin/hooks';
import type { SignupRequestRow } from '@/features/admin/api';
import { ApproveSignupDrawer } from '@/features/admin/components/ApproveSignupDrawer';
import { Button } from '@/features/admin/components/Button';
import { PageHeader } from '@/features/admin/components/PageHeader';
import { RejectSignupModal } from '@/features/admin/components/RejectSignupModal';

export const AdminSignupApprovalsPage = () => {
  const { data, isLoading, error } = usePendingSignups();
  const [approve, setApprove] = useState<SignupRequestRow | null>(null);
  const [reject, setReject] = useState<SignupRequestRow | null>(null);

  return (
    <div>
      <Link
        to="/admin/users"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted hover:text-text"
      >
        <ChevronLeft size={14} /> Back to users
      </Link>

      <PageHeader
        title="Signup approvals"
        subtitle="Pending intake from the public signup wizard."
      />

      {isLoading && <Skeleton className="h-24 w-full rounded" />}
      {error instanceof ApiError && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-[13px] text-danger">
          {error.message}
        </div>
      )}
      {data && data.length === 0 && (
        <EmptyState title="No pending signups" body="All caught up." />
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">ITS</th>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Email</th>
                <th className="px-4 py-2.5 text-left font-semibold">Requested</th>
                <th className="px-4 py-2.5 text-left font-semibold">Submitted</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t border-border-default">
                  <td className="px-4 py-2.5 font-mono text-[12px]">
                    {r.its_number}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-text">{r.name}</td>
                  <td className="px-4 py-2.5 text-muted">{r.email}</td>
                  <td className="px-4 py-2.5 text-[12px]">
                    {[r.event?.name, r.venue?.name, r.department?.name]
                      .filter(Boolean)
                      .join(' • ') || '—'}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => setApprove(r)}
                      >
                        <Check size={12} /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setReject(r)}
                      >
                        <X size={12} /> Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ApproveSignupDrawer
        open={!!approve}
        request={approve}
        onClose={() => setApprove(null)}
      />
      <RejectSignupModal
        open={!!reject}
        request={reject}
        onClose={() => setReject(null)}
      />
    </div>
  );
};
