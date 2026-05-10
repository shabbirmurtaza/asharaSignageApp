/**
 * Resolves the "current event" for chrome surfaces (sidebar, topbar, login).
 * Order of preference:
 *   1. super_admin: scoped event from eventScope, else default event.
 *   2. HOD / production / department_user: first non-null event_id in assignments.
 *   3. fallback: events.is_default = true.
 *
 * Returns the row used to drive accent + identity. Never throws.
 */

import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/rbac';
import { useScopedEventId } from '@/stores/eventScope';

export interface ChromeEventRow {
  id: string;
  name: string;
  year: string;
  hijri_year: string | null;
  city: string | null;
  brand_primary: string | null;
}

const FIELDS = 'id,name,year,hijri_year,city,brand_primary';

export const useChromeEvent = () => {
  const session = useAuth((s) => s.session);
  const scopedEventId = useScopedEventId();
  const isAdmin = isSuperAdmin(session);

  const assignmentEventId = session?.assignments.find((a) => a.event_id)?.event_id ?? null;
  const targetId = isAdmin ? scopedEventId : assignmentEventId;

  return useQuery({
    queryKey: ['chrome-event', targetId ?? 'default'],
    queryFn: async () => {
      if (targetId) {
        const rows = await db.from<ChromeEventRow>('events').select(FIELDS, {
          id: `eq.${targetId}`,
        });
        if (rows[0]) return rows[0];
      }
      const fallback = await db.from<ChromeEventRow>('events').select(FIELDS, {
        is_default: 'eq.true',
        is_archived: 'eq.false',
        limit: '1',
      });
      return fallback[0] ?? null;
    },
    staleTime: 5 * 60_000,
    enabled: !!session,
  });
};
