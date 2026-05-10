import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useDeleteVenue, useVenues } from '@/features/admin/hooks';
import type { VenueRow } from '@/features/admin/api';
import { Button } from '@/features/admin/components/Button';
import { PageHeader } from '@/features/admin/components/PageHeader';
import { VenueDrawer } from '@/features/admin/components/VenueDrawer';
import { ZoneCount } from '@/features/admin/components/ZoneCount';
import { useToast } from '@/stores/toast';

export const AdminVenuesPage = () => {
  const { data, isLoading, error } = useVenues();
  const remove = useDeleteVenue();
  const toast = useToast();
  const [drawer, setDrawer] = useState<{
    open: boolean;
    venue: VenueRow | null;
  }>({ open: false, venue: null });

  const onDelete = async (v: VenueRow) => {
    if (!confirm(`Delete venue "${v.name}"? This also deletes its zones.`)) return;
    try {
      await remove.mutateAsync(v.id);
      toast.success('Venue deleted.');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Venues"
        subtitle="Reusable venues + their zones. Attach venues to events from the Events page."
        actions={
          <Button
            variant="primary"
            onClick={() => setDrawer({ open: true, venue: null })}
          >
            <Plus size={14} /> New venue
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
        <EmptyState title="No venues yet" body="Create one to start." />
      )}

      {data && data.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-card">
          <table className="w-full text-[13px]">
            <thead className="bg-surface text-[11px] uppercase tracking-[0.04em] text-muted">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Name</th>
                <th className="px-4 py-2.5 text-left font-semibold">Type</th>
                <th className="px-4 py-2.5 text-left font-semibold">City</th>
                <th className="px-4 py-2.5 text-left font-semibold">Zones</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((v) => (
                <tr key={v.id} className="border-t border-border-default">
                  <td className="px-4 py-2.5 font-medium text-text">{v.name}</td>
                  <td className="px-4 py-2.5">{v.type}</td>
                  <td className="px-4 py-2.5">{v.city ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <ZoneCount venueId={v.id} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => setDrawer({ open: true, venue: v })}
                      >
                        <Pencil size={12} /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(v)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VenueDrawer
        open={drawer.open}
        venue={drawer.venue}
        onClose={() => setDrawer({ open: false, venue: null })}
      />
    </div>
  );
};
