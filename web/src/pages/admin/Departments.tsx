import { useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import {
  useCreateDepartment,
  useDeleteDepartment,
  useDepartments,
  useUpdateDepartment,
} from '@/features/admin/hooks';
import type { DepartmentRow } from '@/features/admin/api';
import { Button } from '@/features/admin/components/Button';
import { PageHeader } from '@/features/admin/components/PageHeader';
import { inputCls } from '@/features/admin/components/FormField';
import { useToast } from '@/stores/toast';

interface RowState {
  id: string;
  name: string;
  name_lisan: string;
}

export const AdminDepartmentsPage = () => {
  const { data, isLoading, error } = useDepartments();
  const create = useCreateDepartment();
  const update = useUpdateDepartment();
  const remove = useDeleteDepartment();
  const toast = useToast();
  const [edit, setEdit] = useState<RowState | null>(null);
  const [adding, setAdding] = useState<{ name: string; name_lisan: string } | null>(
    null,
  );

  const onSave = async (s: RowState) => {
    try {
      await update.mutateAsync({
        id: s.id,
        patch: { name: s.name.trim(), name_lisan: s.name_lisan || null },
      });
      toast.success('Department updated.');
      setEdit(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onDelete = async (d: DepartmentRow) => {
    if (!confirm(`Delete department "${d.name}"?`)) return;
    try {
      await remove.mutateAsync(d.id);
      toast.success('Department deleted.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onCreate = async () => {
    if (!adding?.name.trim()) return;
    try {
      await create.mutateAsync({
        name: adding.name.trim(),
        name_lisan: adding.name_lisan || null,
      });
      toast.success('Department created.');
      setAdding(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Master list of 32 canonical departments."
        actions={
          <Button
            variant="primary"
            onClick={() => setAdding({ name: '', name_lisan: '' })}
          >
            <Plus size={14} /> New department
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
        <EmptyState title="No departments" body="Add one to start." />
      )}

      {(data && data.length > 0) || adding ? (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  Lisan al-Da&apos;wat
                </th>
                <th className="w-32 px-4 py-2.5 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {adding && (
                <tr className="border-t border-border-default bg-surface/40">
                  <td className="px-4 py-2">
                    <input
                      autoFocus
                      className={inputCls}
                      placeholder="Department name"
                      value={adding.name}
                      onChange={(e) =>
                        setAdding({ ...adding, name: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      dir="rtl"
                      className={inputCls}
                      value={adding.name_lisan}
                      onChange={(e) =>
                        setAdding({ ...adding, name_lisan: e.target.value })
                      }
                    />
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button size="sm" variant="primary" onClick={onCreate}>
                        <Save size={12} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAdding(null)}
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}
              {data?.map((d) =>
                edit?.id === d.id ? (
                  <tr key={d.id} className="border-t border-border-default">
                    <td className="px-4 py-2">
                      <input
                        className={inputCls}
                        value={edit.name}
                        onChange={(e) =>
                          setEdit({ ...edit, name: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        dir="rtl"
                        className={inputCls}
                        value={edit.name_lisan}
                        onChange={(e) =>
                          setEdit({ ...edit, name_lisan: e.target.value })
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => onSave(edit)}
                        >
                          <Save size={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEdit(null)}
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={d.id} className="border-t border-border-default">
                    <td className="px-4 py-2.5 font-medium text-text">{d.name}</td>
                    <td
                      dir="rtl"
                      className="px-4 py-2.5 text-right font-arabic text-text"
                    >
                      {d.name_lisan ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            setEdit({
                              id: d.id,
                              name: d.name,
                              name_lisan: d.name_lisan ?? '',
                            })
                          }
                        >
                          <Pencil size={12} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(d)}
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
