import type { UserStatus } from '../api';

const COLOR: Record<UserStatus, string> = {
  active: 'bg-green-50 text-green-700 border-green-200',
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  disabled: 'bg-gray-100 text-gray-600 border-gray-200',
};

const LABEL: Record<UserStatus, string> = {
  active: 'Active',
  pending_approval: 'Pending',
  rejected: 'Rejected',
  disabled: 'Disabled',
};

export const StatusBadge = ({ status }: { status: UserStatus }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[11px] font-medium ${COLOR[status]}`}
  >
    {LABEL[status]}
  </span>
);
