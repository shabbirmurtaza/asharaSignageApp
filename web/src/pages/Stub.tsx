import type { RoleName } from '@/lib/auth';
import { roleLabel } from '@/lib/rbac';

interface Props {
  title: string;
  description?: string;
  requiredRoles?: RoleName[];
}

export const Stub = ({ title, description, requiredRoles }: Props) => (
  <div className="rounded-lg border border-dashed border-border-strong bg-card p-8">
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
      Placeholder
    </p>
    <h1 className="mt-1 text-xl font-semibold text-text">{title}</h1>
    {description && <p className="mt-2 text-sm text-muted">{description}</p>}
    {requiredRoles && requiredRoles.length > 0 && (
      <p className="mt-4 text-[12px] text-muted">
        Roles: {requiredRoles.map(roleLabel).join(', ')}
      </p>
    )}
    <p className="mt-4 text-[12px] text-hint">
      This screen is scaffolded by Step 2 — the real implementation lands in
      Steps 3–8.
    </p>
  </div>
);
