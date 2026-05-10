import type { RoleName } from '@/lib/auth';
import type {
  DepartmentRow,
  EventRow,
  RoleRow,
  VenueRow,
} from '../api';
import { inputCls } from './FormField';

export interface DraftAssignment {
  /** Existing assignment id, or undefined for unsaved row. */
  id?: string;
  role_id: string;
  event_id: string | null;
  venue_id: string | null;
  department_id: string | null;
}

interface Props {
  draft: DraftAssignment;
  roles: RoleRow[];
  events: EventRow[];
  venues: VenueRow[];
  departments: DepartmentRow[];
  onChange: (next: DraftAssignment) => void;
  onSave: () => void;
  onRemove: () => void;
  isPersisted: boolean;
  isPending: boolean;
}

const ROLE_LABEL: Record<RoleName, string> = {
  super_admin: 'Super Admin',
  signage_hod: 'Signage HOD',
  signage_production: 'Signage Production',
  department_user: 'Department HOD',
  viewer: 'Viewer',
};

export const AssignmentRow = ({
  draft,
  roles,
  events,
  venues,
  departments,
  onChange,
  onSave,
  onRemove,
  isPersisted,
  isPending,
}: Props) => {
  const role = roles.find((r) => r.id === draft.role_id);
  const roleName = role?.name;
  const showVenue = roleName !== 'super_admin' && roleName !== undefined;
  const showDept = roleName === 'department_user';
  const requiresEvent = roleName !== 'super_admin' && roleName !== undefined;

  return (
    <tr className="border-t border-border-default">
      <td className="px-3 py-2">
        <select
          className={inputCls}
          value={draft.role_id}
          onChange={(e) => {
            const nextRole = roles.find((r) => r.id === e.target.value);
            const nextName = nextRole?.name;
            onChange({
              ...draft,
              role_id: e.target.value,
              event_id: nextName === 'super_admin' ? null : draft.event_id,
              venue_id:
                nextName === 'super_admin' || nextName === 'signage_production'
                  ? null
                  : draft.venue_id,
              department_id:
                nextName === 'department_user' ? draft.department_id : null,
            });
          }}
        >
          <option value="">Pick role…</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {ROLE_LABEL[r.name] ?? r.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          className={inputCls}
          value={draft.event_id ?? ''}
          disabled={!requiresEvent}
          onChange={(e) =>
            onChange({ ...draft, event_id: e.target.value || null })
          }
        >
          <option value="">{requiresEvent ? 'Pick event…' : '—'}</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} ({ev.year})
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          className={inputCls}
          value={draft.venue_id ?? ''}
          disabled={!showVenue}
          onChange={(e) =>
            onChange({ ...draft, venue_id: e.target.value || null })
          }
        >
          <option value="">{showVenue ? 'Pick venue…' : '—'}</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        {showDept ? (
          <select
            className={inputCls}
            value={draft.department_id ?? ''}
            onChange={(e) =>
              onChange({ ...draft, department_id: e.target.value || null })
            }
          >
            <option value="">Pick department…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[12px] text-hint">—</span>
        )}
      </td>
      <td className="w-32 px-3 py-2 text-right">
        {!isPersisted ? (
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded bg-text px-2 py-1 text-[11px] font-medium text-white hover:bg-text/90 disabled:opacity-50"
          >
            Add
          </button>
        ) : (
          <button
            type="button"
            onClick={onRemove}
            className="rounded border border-border-strong px-2 py-1 text-[11px] text-text hover:bg-surface"
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
};
