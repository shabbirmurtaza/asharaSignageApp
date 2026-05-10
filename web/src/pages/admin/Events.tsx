import { useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useEvents, useSetDefaultEvent, useUpdateEvent } from '@/features/admin/hooks';
import type { EventRow } from '@/features/admin/api';
import { Button } from '@/features/admin/components/Button';
import { EventDrawer } from '@/features/admin/components/EventDrawer';
import { PageHeader } from '@/features/admin/components/PageHeader';
import { useToast } from '@/stores/toast';

export const AdminEventsPage = () => {
  const { data, isLoading, error } = useEvents();
  const setDefault = useSetDefaultEvent();
  const update = useUpdateEvent();
  const toast = useToast();
  const [drawer, setDrawer] = useState<{ open: boolean; event: EventRow | null }>({
    open: false,
    event: null,
  });

  const onToggleArchived = async (e: EventRow) => {
    try {
      await update.mutateAsync({
        id: e.id,
        patch: { is_archived: !e.is_archived },
      });
      toast.success(`${e.name} ${!e.is_archived ? 'archived' : 'unarchived'}.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const onSetDefault = async (e: EventRow) => {
    try {
      await setDefault.mutateAsync(e.id);
      toast.success(`${e.name} is now the default event.`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Multi-event signage planning. One default event drives signup."
        actions={
          <Button
            variant="primary"
            onClick={() => setDrawer({ open: true, event: null })}
          >
            <Plus size={14} /> New event
          </Button>
        }
      />

      {isLoading && <Skeleton className="h-24 w-full rounded" />}
      {error instanceof ApiError && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-4 text-[13px] text-danger">
          {error.message}
        </div>
      )}
      {data && data.length === 0 && (
        <EmptyState title="No events yet" body="Create your first event." />
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Year</th>
                <th className="px-4 py-2.5 text-left font-semibold">City</th>
                <th className="px-4 py-2.5 text-left font-semibold">Default</th>
                <th className="px-4 py-2.5 text-left font-semibold">Archived</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id} className="border-t border-border-default">
                  <td className="px-4 py-2.5 font-medium text-text">{e.name}</td>
                  <td className="px-4 py-2.5">{e.year}</td>
                  <td className="px-4 py-2.5">{e.city ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <input
                      type="radio"
                      name="default-event"
                      checked={e.is_default}
                      disabled={e.is_archived}
                      onChange={() => onSetDefault(e)}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={e.is_archived}
                        disabled={e.is_default}
                        onChange={() => onToggleArchived(e)}
                      />
                    </label>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      size="sm"
                      onClick={() => setDrawer({ open: true, event: e })}
                    >
                      <Pencil size={12} /> Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <EventDrawer
        open={drawer.open}
        event={drawer.event}
        onClose={() => setDrawer({ open: false, event: null })}
      />
    </div>
  );
};
