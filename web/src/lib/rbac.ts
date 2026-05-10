/**
 * Pure role/scope helpers. UX-only — RLS is the source of truth.
 *
 * Status transitions (mirrors schema_v7.sql):
 *   pending    → approved | rejected            (signage_hod / super_admin)
 *   approved   ↔ designing                      (signage_production / super_admin)
 *   designing  ↔ printing                       (signage_production / super_admin)
 *   printing   ↔ ready                          (signage_production / super_admin)
 *   any        → cancelled                      (super_admin)
 */

import type { Assignment, RoleName, Session } from './auth';

export type Status =
  | 'pending'
  | 'approved'
  | 'designing'
  | 'printing'
  | 'ready'
  | 'rejected'
  | 'cancelled';

const has = (
  s: Session | null,
  pred: (a: Assignment) => boolean,
): boolean => !!s && s.assignments.some(pred);

export const isSuperAdmin = (s: Session | null): boolean =>
  !!s && s.primaryRole === 'super_admin';

export const isSignageHod = (
  s: Session | null,
  eventId: string | null,
  venueId: string | null,
): boolean =>
  isSuperAdmin(s) ||
  has(
    s,
    (a) =>
      a.role === 'signage_hod' &&
      (eventId == null || a.event_id === eventId) &&
      (venueId == null || a.venue_id === venueId),
  );

export const isSignageProduction = (
  s: Session | null,
  eventId: string | null,
): boolean =>
  isSuperAdmin(s) ||
  has(
    s,
    (a) =>
      a.role === 'signage_production' &&
      (eventId == null || a.event_id === eventId),
  );

export const isDepartmentUser = (
  s: Session | null,
  eventId: string | null,
  venueId: string | null,
  deptId: string | null,
): boolean =>
  isSuperAdmin(s) ||
  has(
    s,
    (a) =>
      a.role === 'department_user' &&
      (eventId == null || a.event_id === eventId) &&
      (venueId == null || a.venue_id === venueId) &&
      (deptId == null || a.department_id === deptId),
  );

// First department_user assignment's department_id, or null. Used by the
// sign library to scope reads/writes for dept users — RLS still enforces it
// server-side; this is UX scoping only.
export const myDepartmentId = (s: Session | null): string | null => {
  if (!s) return null;
  const a = s.assignments.find(
    (x) => x.role === 'department_user' && x.department_id,
  );
  return a?.department_id ?? null;
};

export const canApprove = (
  s: Session | null,
  eventId: string,
  venueId: string,
): boolean => isSuperAdmin(s) || isSignageHod(s, eventId, venueId);

const PRODUCTION_TRANSITIONS: ReadonlySet<string> = new Set([
  'approved>designing',
  'designing>approved',
  'designing>printing',
  'printing>designing',
  'printing>ready',
  'ready>printing',
]);

const HOD_TRANSITIONS: ReadonlySet<string> = new Set([
  'pending>approved',
  'pending>rejected',
]);

export const canChangeStatus = (
  s: Session | null,
  eventId: string,
  from: Status,
  to: Status,
): boolean => {
  if (!s) return false;
  if (isSuperAdmin(s)) return true;
  const key = `${from}>${to}`;
  if (HOD_TRANSITIONS.has(key)) {
    // Venue-agnostic check here; caller should also confirm venue match.
    return s.assignments.some(
      (a) => a.role === 'signage_hod' && a.event_id === eventId,
    );
  }
  if (PRODUCTION_TRANSITIONS.has(key)) {
    return isSignageProduction(s, eventId);
  }
  return false;
};

export interface EventLike {
  id: string;
  is_archived?: boolean;
}

export const visibleEvents = <E extends EventLike>(
  s: Session | null,
  allEvents: E[],
): E[] => {
  if (!s) return [];
  if (isSuperAdmin(s)) return allEvents;
  const eventIds = new Set(
    s.assignments.map((a) => a.event_id).filter((x): x is string => !!x),
  );
  return allEvents.filter((e) => eventIds.has(e.id));
};

export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin: 'Super Admin',
  signage_hod: 'Signage HOD',
  signage_production: 'Signage Production',
  department_user: 'Department HOD',
  viewer: 'Viewer',
};

export const roleLabel = (role: RoleName): string => ROLE_LABELS[role] ?? role;

export const defaultRouteForRole = (role: RoleName): string => {
  switch (role) {
    case 'super_admin':
      return '/admin/events';
    case 'signage_hod':
      return '/hod/dashboard';
    case 'signage_production':
      return '/production/pipeline';
    case 'department_user':
      return '/my/requests';
    case 'viewer':
      return '/library';
  }
};
