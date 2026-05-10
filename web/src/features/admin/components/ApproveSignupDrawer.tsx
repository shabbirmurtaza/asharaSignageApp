import { useEffect, useState } from 'react';
import type { RoleName } from '@/lib/auth';
import { useApproveSignup } from '../hooks';
import type { SignupRequestRow } from '../api';
import { useToast } from '@/stores/toast';
import { Button } from './Button';
import { Drawer } from './Drawer';
import { FormField, inputCls } from './FormField';

interface Props {
  open: boolean;
  request: SignupRequestRow | null;
  onClose: () => void;
}

const ROLES: { value: RoleName; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'signage_hod', label: 'Signage HOD' },
  { value: 'signage_production', label: 'Signage Production' },
  { value: 'department_user', label: 'Department HOD' },
  { value: 'viewer', label: 'Viewer' },
];

export const ApproveSignupDrawer = ({ open, request, onClose }: Props) => {
  const [role, setRole] = useState<RoleName>('viewer');
  const approve = useApproveSignup();
  const toast = useToast();

  useEffect(() => {
    if (open) setRole('viewer');
  }, [open]);

  const onSubmit = async () => {
    if (!request) return;
    try {
      await approve.mutateAsync({ reqId: request.id, role });
      toast.success(`${request.name} approved as ${role}.`);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (!request) return null;
  // signage_hod has no department per cerebrum / trigger.
  const showDept = role === 'department_user';
  const showVenue = role !== 'super_admin';
  const showEvent = role !== 'super_admin';

  return (
    <Drawer
      open={open}
      title={`Approve ${request.name}`}
      subtitle={`ITS ${request.its_number} • ${request.email}`}
      onClose={onClose}
      width="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={approve.isPending}
          >
            Approve as {ROLES.find((r) => r.value === role)?.label}
          </Button>
        </div>
      }
    >
      <FormField label="Role">
        <select
          className={inputCls}
          value={role}
          onChange={(e) => setRole(e.target.value as RoleName)}
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </FormField>
      {showEvent && (
        <FormField label="Event">
          <input
            readOnly
            className={inputCls}
            value={request.event?.name ?? '—'}
          />
        </FormField>
      )}
      {showVenue && (
        <FormField label="Venue">
          <input
            readOnly
            className={inputCls}
            value={request.venue?.name ?? '—'}
          />
        </FormField>
      )}
      {showDept && (
        <FormField label="Department">
          <input
            readOnly
            className={inputCls}
            value={request.department?.name ?? '—'}
          />
        </FormField>
      )}
      {role === 'signage_hod' && (
        <p className="rounded border border-border-default bg-surface px-3 py-2 text-[11px] text-muted">
          Signage HOD covers all departments at the venue — department selection
          will be ignored.
        </p>
      )}
    </Drawer>
  );
};
