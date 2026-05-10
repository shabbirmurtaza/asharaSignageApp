/**
 * Signage HOD dashboard — KPI strip + recent activity for the active venue.
 * Uses the per-event accent color (events.brand_primary) on the hero strip
 * so identity comes through chrome, not just data.
 */

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { ApiError, db } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { StatusPill } from '@/components/StatusPill';
import {
  useEvent,
  useVenue,
  useVenueActivity,
  useVenueStatusCounts,
} from '@/features/hod/hooks';
import type { StatusCounts } from '@/features/hod/api';
import { useHodScope } from '@/features/hod/scope';
import { PlaceOrderDrawer } from '@/features/hod/PlaceOrderDrawer';
import { accentTokens } from '@/lib/accent';

const KPI_ORDER: Array<{ key: keyof StatusCounts; label: string; primary?: boolean }> = [
  { key: 'pending', label: 'Pending', primary: true },
  { key: 'approved', label: 'Approved' },
  { key: 'designing', label: 'Designing' },
  { key: 'printing', label: 'Printing' },
  { key: 'ready', label: 'Ready' },
];

interface ScopeOption {
  eventId: string;
  venueId: string;
  label: string;
}

const useScopeOptions = (
  scopes: { eventId: string; venueId: string }[],
): ScopeOption[] => {
  const eventIds = useMemo(
    () => Array.from(new Set(scopes.map((s) => s.eventId))),
    [scopes],
  );
  const venueIds = useMemo(
    () => Array.from(new Set(scopes.map((s) => s.venueId))),
    [scopes],
  );
  const eventQueries = useQueries({
    queries: eventIds.map((id) => ({
      queryKey: ['hod-event', id],
      queryFn: () =>
        db.from<{ id: string; year: string }>('events').select(
          'id,year',
          { id: `eq.${id}` },
        ).then((r) => r[0] ?? null),
      staleTime: 60_000,
    })),
  });
  const venueQueries = useQueries({
    queries: venueIds.map((id) => ({
      queryKey: ['hod-venue', id],
      queryFn: () =>
        db.from<{ id: string; name: string }>('venues').select(
          'id,name',
          { id: `eq.${id}` },
        ).then((r) => r[0] ?? null),
      staleTime: 60_000,
    })),
  });
  const eventName = (id: string) => {
    const idx = eventIds.indexOf(id);
    return eventQueries[idx]?.data?.year ?? id.slice(0, 6);
  };
  const venueName = (id: string) => {
    const idx = venueIds.indexOf(id);
    return venueQueries[idx]?.data?.name ?? id.slice(0, 6);
  };
  return scopes.map((s) => ({
    ...s,
    label: `${eventName(s.eventId)} · ${venueName(s.venueId)}`,
  }));
};

export const HodDashboardPage = () => {
  const { active, scopes, setActive, hasScope } = useHodScope();
  const [drawer, setDrawer] = useState(false);

  const event = useEvent(active?.eventId);
  const venue = useVenue(active?.venueId);
  const counts = useVenueStatusCounts(active?.eventId, active?.venueId);
  const activity = useVenueActivity(active?.eventId, active?.venueId);
  const scopeOptions = useScopeOptions(scopes);

  if (!hasScope) {
    return (
      <EmptyState
        title="No HOD venue assigned"
        body="Ask a super admin to assign you a Signage HOD scope (event + venue)."
      />
    );
  }
  if (!active) return null;

  const accent = accentTokens(event.data?.brand_primary);

  return (
    <div>
      {/* Hero strip — per-event accent. Carries identity into chrome. */}
      <div
        className="mb-5 overflow-hidden rounded-lg border"
        style={{
          background: accent.tint,
          borderColor: accent.border,
        }}
      >
        <div
          aria-hidden
          className="h-1 w-full"
          style={{ background: accent.strip }}
        />
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="text-eyebrow uppercase text-muted">
              {event.data ? `${event.data.year}${event.data.hijri_year ? ` / ${event.data.hijri_year}` : ''}` : 'Event'}
              {event.data?.city ? ` · ${event.data.city}` : ''}
            </p>
            <h1 className="mt-0.5 truncate text-h1 text-text">
              {venue.data?.name ?? 'Venue'}
            </h1>
            <p className="text-body-sm text-muted">
              Approve requests, track production, place orders on behalf of any department.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scopes.length > 1 && (
              <select
                aria-label="Switch HOD scope"
                className="h-8 rounded-sm border border-border-strong bg-card px-2 text-body-sm"
                value={`${active.eventId}:${active.venueId}`}
                onChange={(e) => {
                  const [eventId, venueId] = e.target.value.split(':');
                  setActive({ eventId, venueId });
                }}
              >
                {scopeOptions.map((s) => (
                  <option key={`${s.eventId}:${s.venueId}`} value={`${s.eventId}:${s.venueId}`}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setDrawer(true)}
              className="flex h-8 items-center gap-1.5 rounded-sm px-3 text-body-sm font-medium"
              style={{ background: accent.base, color: accent.fg }}
            >
              <Plus size={14} /> Place order
            </button>
          </div>
        </div>
      </div>

      {/* KPI strip — single ink card highlights pending; rest are quiet meta cells */}
      <div className="mb-6 overflow-hidden rounded-lg border border-border-default bg-card">
        <div className="grid grid-cols-2 divide-y divide-border-default md:grid-cols-5 md:divide-x md:divide-y-0">
          {KPI_ORDER.map(({ key, label, primary }) => {
            const value = counts.isLoading ? '…' : counts.data?.[key] ?? 0;
            return (
              <div
                key={key}
                className={`px-4 py-3 ${primary ? 'bg-text text-white' : ''}`}
              >
                <p
                  className={`text-eyebrow uppercase ${primary ? 'text-white/70' : 'text-muted'}`}
                >
                  {label}
                </p>
                <p
                  className={`mt-1 text-stat ${primary ? 'text-white' : 'text-text'}`}
                >
                  {value}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="mb-2 text-eyebrow uppercase text-muted">Recent activity</h2>
      {activity.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded" />
          ))}
        </div>
      )}
      {activity.error instanceof ApiError && (
        <div className="rounded-md border border-danger-border bg-danger-bg p-3 text-body-sm text-danger">
          {activity.error.message}
        </div>
      )}
      {activity.data && activity.data.length === 0 && (
        <EmptyState title="No recent activity" />
      )}
      {activity.data && activity.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border-default bg-card">
          <table className="w-full text-body-sm">
            <thead className="bg-surface">
              <tr className="text-eyebrow uppercase text-muted">
                <th className="px-4 py-2 text-left font-semibold">When</th>
                <th className="px-2 py-2 text-left font-semibold">Sign</th>
                <th className="px-2 py-2 text-left font-semibold">Department</th>
                <th className="px-2 py-2 text-left font-semibold">Status</th>
                <th className="px-4 py-2 text-left font-semibold">By</th>
              </tr>
            </thead>
            <tbody>
              {activity.data.map((row) => (
                <tr key={row.id} className="border-t border-border-default">
                  <td className="px-4 py-2 text-meta text-muted whitespace-nowrap">
                    {new Date(row.changed_at).toLocaleString()}
                  </td>
                  <td className="px-2 py-2 font-medium text-text">
                    {row.usage?.sign?.canonical_name ?? '—'}
                  </td>
                  <td className="px-2 py-2 text-muted">{row.usage?.department?.name ?? '—'}</td>
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {row.from_status && (
                        <>
                          <span className="opacity-50">
                            <StatusPill status={row.from_status as never} />
                          </span>
                          <span aria-hidden className="text-hint">→</span>
                        </>
                      )}
                      <StatusPill status={row.to_status as never} />
                    </span>
                  </td>
                  <td className="px-4 py-2 text-meta text-muted">
                    {row.changed_by_name ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PlaceOrderDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        eventId={active.eventId}
        venueId={active.venueId}
      />
    </div>
  );
};
