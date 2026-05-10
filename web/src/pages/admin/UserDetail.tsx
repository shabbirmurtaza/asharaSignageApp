import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, KeyRound, Power } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import {
  useDisableUser,
  useEnableUser,
  useUser,
} from '@/features/admin/hooks';
import { AssignmentsEditor } from '@/features/admin/components/AssignmentsEditor';
import { Button } from '@/features/admin/components/Button';
import { PageHeader } from '@/features/admin/components/PageHeader';
import { ResetPasswordModal } from '@/features/admin/components/ResetPasswordModal';
import { StatusBadge } from '@/features/admin/components/StatusBadge';
import { useToast } from '@/stores/toast';

export const AdminUserDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { data: user, isLoading, error } = useUser(id);
  const disable = useDisableUser();
  const enable = useEnableUser();
  const toast = useToast();
  const [showReset, setShowReset] = useState(false);

  if (isLoading) return <Skeleton className="h-32 w-full rounded" />;
  if (error instanceof ApiError) {
    return (
      <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-[13px] text-danger">
        {error.message}
      </div>
    );
  }
  if (!user) return null;

  const onToggle = async () => {
    try {
      if (user.status === 'active') {
        await disable.mutateAsync(user.id);
        toast.success('User disabled.');
      } else {
        await enable.mutateAsync(user.id);
        toast.success('User enabled.');
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <Link
        to="/admin/users"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-muted hover:text-text"
      >
        <ChevronLeft size={14} /> Back to users
      </Link>

      <PageHeader
        title={user.name}
        subtitle={`ITS ${user.its_number} • ${user.email}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={user.status} />
            <Button
              variant="secondary"
              onClick={() => setShowReset(true)}
            >
              <KeyRound size={14} /> Reset password
            </Button>
            <Button
              variant={user.status === 'active' ? 'ghost' : 'secondary'}
              onClick={onToggle}
              disabled={user.status === 'pending_approval'}
            >
              <Power size={14} />{' '}
              {user.status === 'active' ? 'Disable' : 'Enable'}
            </Button>
          </div>
        }
      />

      <section className="mt-2 rounded-lg border border-border-default bg-card p-4">
        <h2 className="mb-3 text-[14px] font-semibold text-text">Role assignments</h2>
        <AssignmentsEditor userId={user.id} />
      </section>

      <ResetPasswordModal
        open={showReset}
        userId={user.id}
        userName={user.name}
        onClose={() => setShowReset(false)}
      />
    </div>
  );
};
