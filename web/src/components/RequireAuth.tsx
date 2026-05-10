import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type RoleName } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/rbac';

interface Props {
  children: ReactNode;
  /** If set, only these roles (or super_admin) may enter. */
  allow?: RoleName[];
}

export const RequireAuth = ({ children, allow }: Props) => {
  const session = useAuth((s) => s.session);
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allow && !isSuperAdmin(session) && !allow.includes(session.primaryRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
