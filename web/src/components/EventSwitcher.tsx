import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/rbac';
import { useEventScope } from '@/stores/eventScope';

interface EventRow {
  id: string;
  name: string;
  year: string;
  city: string;
  is_default: boolean;
  is_archived: boolean;
}

export const EventSwitcher = () => {
  const session = useAuth((s) => s.session);
  const selected = useEventScope((s) => s.selected);
  const setSelected = useEventScope((s) => s.setSelected);

  const enabled = isSuperAdmin(session);

  const { data: events } = useQuery({
    queryKey: ['events', 'switcher'],
    enabled,
    queryFn: () =>
      db.from<EventRow>('events').select('id,name,year,city,is_default,is_archived', {
        is_archived: 'eq.false',
        order: 'created_at.desc',
      }),
  });

  if (!enabled) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">
        Event
      </span>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value as string | 'all')}
        className="h-8 rounded-sm border border-border-strong bg-card px-2 text-[13px]"
      >
        <option value="all">All events</option>
        {(events ?? []).map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {e.is_default ? ' (default)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
};
