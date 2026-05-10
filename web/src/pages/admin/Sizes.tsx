import { useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import {
  useCreateSize,
  useDeleteSize,
  useSizes,
  useUpdateSize,
} from '@/features/admin/hooks';
import type { SizeRow } from '@/features/admin/api';
import { Button } from '@/features/admin/components/Button';
import { PageHeader } from '@/features/admin/components/PageHeader';
import { inputCls } from '@/features/admin/components/FormField';
import { useToast } from '@/stores/toast';

interface RowState {
  id?: string;
  name: string;
  height: string;
  width: string;
}

const empty: RowState = { name: '', height: '', width: '' };

export const AdminSizesPage = () => {
  const { data, isLoading, error } = useSizes();
  const create = useCreateSize();
  const update = useUpdateSize();
  const remove = useDeleteSize();
  const toast = useToast();
  const [edit, setEdit] = useState<RowState | null>(null);
  const [adding, setAdding] = useState<RowState | null>(null);

  const onSubmit = async (s: RowState) => {
    const h = Number(s.height);
    const w = Number(s.width);
    if (!h || !w) {
      toast.error('Height and width are required.');
      return;
    }
    try {
      if (s.id) {
        await update.mutateAsync({
          id: s.id,
          patch: { name: s.name || null, height: h, width: w },
        });
        toast.success('Size updated.');
        setEdit(null);
      } else {
        await create.mutateAsync({ name: s.name || null, height: h, width: w });
        toast.success('Size created.');
        setAdding(null);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (s: SizeRow) => {
    if (!confirm(`Delete size "${s.name ?? `${s.height}×${s.width}`}"?`)) return;
    try {
      await remove.mutateAsync(s.id);
      toast.success('Size deleted.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const renderEditableRow = (s: RowState, onCancel: () => void) => (
    <>
      <td className="px-4 py-2">
        <input
          className={inputCls}
          placeholder="A1, Banner, ..."
          value={s.name}
          onChange={(e) =>
            (s === edit ? setEdit : setAdding)({ ...s, name: e.target.value })
          }
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          className={inputCls}
          value={s.height}
          onChange={(e) =>
            (s === edit ? setEdit : setAdding)({ ...s, height: e.target.value })
          }
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          className={inputCls}
          value={s.width}
          onChange={(e) =>
            (s === edit ? setEdit : setAdding)({ ...s, width: e.target.value })
          }
        />
      </td>
      <td className="px-4 py-2 text-right text-hint">auto</td>
      <td className="px-4 py-2 text-right">
        <div className="inline-flex gap-1.5">
          <Button size="sm" variant="primary" onClick={() => onSubmit(s)}>
            <Save size={12} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X size={12} />
          </Button>
        </div>
      </td>
    </>
  );

  return (
    <div>
      <PageHeader
        title="Sizes"
        subtitle="Reusable sign sizes. sqft auto-computed by Postgres."
        actions={
          <Button variant="primary" onClick={() => setAdding({ ...empty })}>
            <Plus size={14} /> New size
          </Button>
        }
      />
      {isLoading && <Skeleton className="h-24 w-full rounded" />}
      {error instanceof ApiError && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-[13px] text-danger">
          {error.message}
        </div>
      )}
      {data && data.length === 0 && !adding && (
        <EmptyState title="No sizes" body="Add one to start." />
      )}
      {(data && data.length > 0) || adding ? (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Label</th>
                <th className="px-4 py-2.5 text-left font-semibold">
                  Height (in)
                </th>
                <th className="px-4 py-2.5 text-left font-semibold">
                  Width (in)
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">sqft</th>
                <th className="w-32 px-4 py-2.5 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr className="border-t border-border-default bg-surface/40">
                  {renderEditableRow(adding, () => setAdding(null))}
                </tr>
              )}
              {data?.map((s) =>
                edit?.id === s.id ? (
                  <tr key={s.id} className="border-t border-border-default">
                    {renderEditableRow(edit, () => setEdit(null))}
                  </tr>
                ) : (
                  <tr key={s.id} className="border-t border-border-default">
                    <td className="px-4 py-2.5 font-medium text-text">
                      {s.name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">{s.height}</td>
                    <td className="px-4 py-2.5">{s.width}</td>
                    <td className="px-4 py-2.5 text-right">{s.sqft}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            setEdit({
                              id: s.id,
                              name: s.name ?? '',
                              height: String(s.height),
                              width: String(s.width),
                            })
                          }
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(s)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
};
