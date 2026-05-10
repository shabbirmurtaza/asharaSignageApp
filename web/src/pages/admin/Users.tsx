import { Link } from 'react-router-dom';
import { Power, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import {
  useDisableUser,
  useEnableUser,
  useUsers,
} from '@/features/admin/hooks';
import type { UserRow } from '@/features/admin/api';
import { Button } from '@/features/admin/components/Button';
import { PageHeader } from '@/features/admin/components/PageHeader';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { useScopedEventId } from '@/stores/eventScope';
import { useToast } from '@/stores/toast';

export const AdminUsersPage = () => {
  const eventId = useScopedEventId();
  const { data, isLoading, error } = useUsers(eventId);
  const disable = useDisableUser();
  const enable = useEnableUser();
  const toast = useToast();

  const onToggle = async (u: UserRow) => {
    try {
      if (u.status === 'active') {
        await disable.mutateAsync(u.id);
        toast.success(`${u.name} disabled.`);
      } else {
        await enable.mutateAsync(u.id);
        toast.success(`${u.name} enabled.`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={
          eventId
            ? 'Filtered to current event scope.'
            : 'All users across all events.'
        }
        actions={
          <Link to="/admin/users/approvals">
            <Button variant="secondary">
              <ShieldCheck size={14} /> Pending approvals
            </Button>
          </Link>
        }
      />

      {isLoading && <Skeleton className="h-24 w-full rounded" />}
      {error instanceof ApiError && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-[13px] text-danger">
          {error.message}
        </div>
      )}
      {data && data.length === 0 && (
        <EmptyState title="No users" body="No users in scope yet." />
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">ITS</th>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Email</th>
                <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr
                  key={u.id}
                  className="cursor-pointer border-t border-border-default hover:bg-surface/40"
                >
                  <td className="px-4 py-2.5 font-mono text-[12px]">
                    <Link to={`/admin/users/${u.id}`}>{u.its_number}</Link>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-text">
                    <Link to={`/admin/users/${u.id}`}>{u.name}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={u.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant={u.status === 'active' ? 'ghost' : 'secondary'}
                      onClick={() => onToggle(u)}
                      disabled={u.status === 'pending_approval'}
                    >
                      <Power size={12} />{' '}
                      {u.status === 'active' ? 'Disable' : 'Enable'}
                    </Button>
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
