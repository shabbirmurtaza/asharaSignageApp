import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  useAddAssignment,
  useAssignments,
  useDepartments,
  useEvents,
  useRemoveAssignment,
  useRoles,
  useVenues,
} from '../hooks';
import { useToast } from '@/stores/toast';
import { AssignmentRow, type DraftAssignment } from './AssignmentRow';
import { Button } from './Button';

interface Props {
  userId: string;
}

const emptyDraft: DraftAssignment = {
  role_id: '',
  event_id: null,
  venue_id: null,
  department_id: null,
};

export const AssignmentsEditor = ({ userId }: Props) => {
  const { data: assignments = [] } = useAssignments(userId);
  const { data: roles = [] } = useRoles();
  const { data: events = [] } = useEvents();
  const { data: venues = [] } = useVenues();
  const { data: departments = [] } = useDepartments();
  const add = useAddAssignment(userId);
  const remove = useRemoveAssignment(userId);
  const toast = useToast();

  const [draft, setDraft] = useState<DraftAssignment | null>(null);

  const onSaveDraft = async () => {
    if (!draft || !draft.role_id) {
      toast.error('Pick a role first.');
      return;
    }
    try {
      await add.mutateAsync({ user_id: userId, ...draft });
      toast.success('Assignment added.');
      setDraft(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onRemove = async (id: string) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      await remove.mutateAsync(id);
      toast.success('Assignment removed.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] text-muted">
          Each row maps the user to a role within an event/venue/department
          scope. Trigger rules: super_admin = no scope; signage_hod = event +
          venue (no dept); department_user = event + venue + dept.
        </p>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setDraft({ ...emptyDraft })}
          disabled={!!draft}
        >
          <Plus size={12} /> Add row
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border-default bg-card">
        <table className="w-full text-[13px]">
          <thead className="bg-surface text-[11px] uppercase tracking-[0.04em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Role</th>
              <th className="px-3 py-2 text-left font-semibold">Event</th>
              <th className="px-3 py-2 text-left font-semibold">Venue</th>
              <th className="px-3 py-2 text-left font-semibold">Department</th>
              <th className="w-32 px-3 py-2 text-right font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {draft && (
              <AssignmentRow
                draft={draft}
                roles={roles}
                events={events}
                venues={venues}
                departments={departments}
                onChange={setDraft}
                onSave={onSaveDraft}
                onRemove={() => setDraft(null)}
                isPersisted={false}
                isPending={add.isPending}
              />
            )}
            {assignments.map((a) => (
              <AssignmentRow
                key={a.id}
                draft={{
                  id: a.id,
                  role_id: a.role_id,
                  event_id: a.event_id,
                  venue_id: a.venue_id,
                  department_id: a.department_id,
                }}
                roles={roles}
                events={events}
                venues={venues}
                departments={departments}
                onChange={() => undefined}
                onSave={() => undefined}
                onRemove={() => onRemove(a.id)}
                isPersisted
                isPending={false}
              />
            ))}
            {assignments.length === 0 && !draft && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 text-center text-[12px] text-hint"
                >
                  No assignments yet — click &ldquo;Add row&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
