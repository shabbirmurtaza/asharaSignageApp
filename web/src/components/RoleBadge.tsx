import type { RoleName } from '@/lib/auth';
import { roleLabel } from '@/lib/rbac';

interface Props {
  role: RoleName;
}

export const RoleBadge = ({ role }: Props) => {
  const initials = roleLabel(role)
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('');
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-card px-3 py-1 text-xs shadow-sm">
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-text text-[10px] font-semibold text-white">
        {initials}
      </span>
      {roleLabel(role)}
    </span>
  );
};
