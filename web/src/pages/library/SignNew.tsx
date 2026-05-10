/**
 * Catalogue maintenance — adds a sign without ordering it. Visible to
 * super_admin, signage_hod, and department_user. RLS rejects inserts where
 * department_id doesn't match the caller's dept (department_user) or unless
 * the caller is super_admin.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { EmptyState } from '@/components/EmptyState';
import { useAuth } from '@/lib/auth';
import { myDepartmentId } from '@/lib/rbac';
import {
  useCreateSignDirectly,
  useDepartments,
  useSignTypes,
} from '@/features/hod/hooks';

const schema = z.object({
  canonicalName: z.string().min(2, 'Name must be at least 2 chars'),
  descriptionLisan: z.string().max(500).optional(),
  signTypeId: z.string().uuid('Pick a sign type'),
  departmentId: z.string().uuid('Pick a department'),
});

const TYPE_LABELS: Record<string, string> = {
  prohibition: 'Prohibition (red)',
  mandatory: 'Mandatory (blue)',
  warning: 'Warning (yellow)',
  safe_condition: 'Safe condition (green)',
  direction: 'Direction',
  place: 'Place',
  notice: 'Notice',
};

export const LibrarySignNewPage = () => {
  const nav = useNavigate();
  const toast = useToast();
  const session = useAuth((s) => s.session);
  const types = useSignTypes();
  const depts = useDepartments();
  const create = useCreateSignDirectly();

  const lockedDeptId = useMemo(
    () => (session?.primaryRole === 'department_user' ? myDepartmentId(session) : null),
    [session],
  );

  const [canonicalName, setCanonicalName] = useState('');
  const [descriptionLisan, setDescriptionLisan] = useState('');
  const [signTypeId, setSignTypeId] = useState('');
  const [pickedDeptId, setPickedDeptId] = useState('');
  const departmentId = lockedDeptId ?? pickedDeptId;
  const [error, setError] = useState<string | null>(null);

  const lockedDeptName = useMemo(() => {
    if (!lockedDeptId) return null;
    return depts.data?.find((d) => d.id === lockedDeptId)?.name ?? null;
  }, [lockedDeptId, depts.data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({
      canonicalName: canonicalName.trim(),
      descriptionLisan: descriptionLisan.trim() || undefined,
      signTypeId,
      departmentId,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }
    try {
      const created = await create.mutateAsync({
        canonicalName: parsed.data.canonicalName,
        descriptionLisan: parsed.data.descriptionLisan ?? null,
        signTypeId: parsed.data.signTypeId,
        departmentId: parsed.data.departmentId,
      });
      toast.success('Sign added to catalogue');
      nav(`/library/${created.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to add sign';
      setError(msg);
      toast.error(msg);
    }
  };

  if (types.error instanceof ApiError) {
    return <EmptyState title="Failed to load sign types" body={types.error.message} />;
  }

  const inputCls =
    'h-9 w-full rounded-sm border border-border-strong bg-card px-2.5 text-[13px] text-text';

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-text">New sign</h1>
      <p className="mb-4 text-[13px] text-muted">
        Add a sign to the catalogue. No usage is created — use the dashboard's
        "Place order" to actually request prints.
      </p>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Department
          {lockedDeptId ? (
            <input
              className={`${inputCls} bg-surface text-muted`}
              value={lockedDeptName ?? '—'}
              disabled
              readOnly
            />
          ) : (
            <select
              className={inputCls}
              value={pickedDeptId}
              onChange={(e) => setPickedDeptId(e.target.value)}
            >
              <option value="">Select a department…</option>
              {depts.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Canonical name
          <input
            className={inputCls}
            value={canonicalName}
            onChange={(e) => setCanonicalName(e.target.value)}
            placeholder="e.g. No smoking"
          />
        </label>

        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Description (LuD / Arabic) — optional
          <textarea
            className={`${inputCls} min-h-[70px]`}
            value={descriptionLisan}
            onChange={(e) => setDescriptionLisan(e.target.value)}
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-[12px] text-muted">Sign type</legend>
          <div className="grid grid-cols-2 gap-2">
            {types.data?.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-[13px] ${
                  signTypeId === t.id
                    ? 'border-text bg-surface'
                    : 'border-border-default hover:bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name="signType"
                  value={t.id}
                  checked={signTypeId === t.id}
                  onChange={() => setSignTypeId(t.id)}
                />
                {TYPE_LABELS[t.name] ?? t.name}
              </label>
            ))}
          </div>
        </fieldset>

        {error && (
          <p className="rounded-md border border-danger-border bg-danger-bg p-2 text-[12px] text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => nav('/library')}
            className="h-9 rounded-sm border border-border-strong px-3 text-[13px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="h-9 rounded-sm bg-text px-4 text-[13px] font-medium text-white disabled:opacity-60"
          >
            {create.isPending ? 'Saving…' : 'Add sign'}
          </button>
        </div>
      </form>
    </div>
  );
};
