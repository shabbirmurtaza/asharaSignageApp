import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ApiError, db } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isSuperAdmin, type Status } from '@/lib/rbac';
import { useScopedEventId } from '@/stores/eventScope';
import { useToast } from '@/stores/toast';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { usePipeline, useTransition } from '@/features/production/hooks';
import {
  PIPELINE_COLUMNS,
  allowedTransitions,
  COLUMN_LABEL,
  isPipelineStatus,
  type PipelineStatus,
} from '@/features/production/transitions';
import { KanbanColumn } from '@/features/production/KanbanColumn';
import type { PipelineUsage } from '@/features/production/api';

interface EventRow {
  id: string;
  name: string;
  is_default: boolean;
}

/**
 * Resolves the event id for the pipeline:
 *  - super_admin: useEventScope; if 'all', fall back to first available event.
 *  - signage_production: take the first event_id from their assignments.
 */
const useResolvedEventId = (): {
  eventId: string | null;
  events: EventRow[];
  loading: boolean;
} => {
  const session = useAuth((s) => s.session);
  const scopedEventId = useScopedEventId();
  const isAdmin = isSuperAdmin(session);

  const { data: events, isLoading } = useQuery({
    queryKey: ['events', 'pipeline-resolver'],
    queryFn: () =>
      db.from<EventRow>('events').select('id,name,is_default', {
        is_archived: 'eq.false',
        order: 'is_default.desc,created_at.desc',
      }),
    enabled: isAdmin,
  });

  const eventId = useMemo(() => {
    if (isAdmin) {
      if (scopedEventId) return scopedEventId;
      return events?.[0]?.id ?? null;
    }
    const a = session?.assignments.find(
      (x) => x.role === 'signage_production' && x.event_id,
    );
    return a?.event_id ?? null;
  }, [isAdmin, scopedEventId, events, session]);

  return { eventId, events: events ?? [], loading: isAdmin && isLoading };
};

const useEventName = (
  eventId: string | null,
  knownEvents: EventRow[],
): string => {
  const known = knownEvents.find((e) => e.id === eventId);
  const { data } = useQuery({
    queryKey: ['events', 'name', eventId],
    queryFn: () =>
      db
        .from<EventRow>('events')
        .select('id,name,is_default', { id: `eq.${eventId}` }),
    enabled: !!eventId && !known,
  });
  return known?.name ?? data?.[0]?.name ?? '';
};

interface PipelineHeaderProps {
  eventName: string;
  grouped: Record<PipelineStatus, PipelineUsage[]>;
}

const STUCK_DAYS = 2;

const PipelineHeader = ({ eventName, grouped }: PipelineHeaderProps) => {
  // Aging is recomputed only when the underlying data signature changes;
  // the cutoff is captured at that moment, which keeps render pure.
  const signature = useMemo(() => {
    const ids: string[] = [];
    for (const s of PIPELINE_COLUMNS) {
      for (const u of grouped[s]) ids.push(`${u.id}:${u.updated_at}`);
    }
    return ids.join('|');
  }, [grouped]);

  const { stuck, total } = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity -- aging is intentionally re-derived from now whenever data changes
    const cutoff = Date.now() - STUCK_DAYS * 24 * 60 * 60_000;
    let stuckCount = 0;
    let totalCount = 0;
    for (const s of PIPELINE_COLUMNS) {
      if (s === 'ready') continue;
      for (const u of grouped[s]) {
        totalCount += 1;
        if (new Date(u.updated_at).getTime() < cutoff) stuckCount += 1;
      }
    }
    return { stuck: stuckCount, total: totalCount };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-h1 text-text">
          Production Pipeline{eventName ? ` — ${eventName}` : ''}
        </h1>
        <p className="text-body-sm text-muted">
          Drag cards or press Advance to move forward.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 text-meta ${
            stuck > 0
              ? 'border-warn-border bg-warn-bg text-warn'
              : 'border-border-default bg-card text-muted'
          }`}
        >
          <span className="font-semibold">{stuck}</span> stuck &gt; {STUCK_DAYS}d
        </span>
        <span className="inline-flex h-7 items-center gap-2 rounded-full border border-border-default bg-card px-3 text-meta text-muted">
          <span className="font-semibold text-text">{total}</span> in flight
        </span>
      </div>
    </header>
  );
};

const ColumnSkeleton = () => (
  <div className="kcol">
    <div className="kcol-h">
      <Skeleton className="h-4 w-20" />
    </div>
    <div className="kcol-body space-y-2">
      <Skeleton className="h-14 w-full rounded" />
      <Skeleton className="h-14 w-full rounded" />
      <Skeleton className="h-14 w-full rounded" />
    </div>
  </div>
);

export const ProductionPipelinePage = () => {
  const toast = useToast();
  const { eventId, events, loading: eventLoading } = useResolvedEventId();
  const eventName = useEventName(eventId, events);
  const { data, isLoading, error } = usePipeline(eventId);
  const transition = useTransition(eventId);
  const dragRef = useRef<PipelineUsage | null>(null);
  const [dragSourceStatus, setDragSourceStatus] = useState<PipelineStatus | null>(null);

  const grouped = useMemo(() => {
    const acc: Record<PipelineStatus, PipelineUsage[]> = {
      approved: [],
      designing: [],
      printing: [],
      ready: [],
    };
    for (const u of data ?? []) {
      if (isPipelineStatus(u.status)) acc[u.status].push(u);
    }
    return acc;
  }, [data]);

  const runTransition = (id: string, from: Status, to: Status) => {
    transition.mutate(
      { id, from, to },
      {
        onError: (err) => {
          const msg =
            err instanceof ApiError && (err.status === 401 || err.status === 403)
              ? 'Not allowed'
              : err.message || 'Transition failed';
          toast.error(msg);
        },
        onSuccess: () => {
          toast.success(`Moved to ${to}`);
        },
      },
    );
  };

  const handleDrop = (target: PipelineStatus) => {
    const u = dragRef.current;
    dragRef.current = null;
    if (!u) return;
    if (u.status === target) return;
    const allowed = isPipelineStatus(u.status)
      ? allowedTransitions[u.status]
      : [];
    if (!allowed.includes(target)) {
      toast.error(
        `Cannot move from ${COLUMN_LABEL[u.status as PipelineStatus] ?? u.status} to ${COLUMN_LABEL[target]}`,
      );
      return;
    }
    runTransition(u.id, u.status, target);
  };

  if (eventLoading || (eventId && isLoading)) {
    return (
      <div>
        <div className="mb-4">
          <Skeleton className="h-6 w-72" />
        </div>
        <div className="kanban grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <ColumnSkeleton />
          <ColumnSkeleton />
          <ColumnSkeleton />
          <ColumnSkeleton />
        </div>
      </div>
    );
  }

  if (!eventId) {
    return (
      <EmptyState
        title="No event in scope"
        body="Pick an event from the switcher above, or ask an admin to assign you to one."
      />
    );
  }

  return (
    <div>
      <PipelineHeader eventName={eventName} grouped={grouped} />

      {error instanceof ApiError && (
        <div className="mb-3 rounded-md border border-danger-border bg-danger-bg p-3 text-[13px] text-danger">
          {error.message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {PIPELINE_COLUMNS.map((status) => {
          let dropState: 'allowed' | 'blocked' | null = null;
          if (dragSourceStatus) {
            if (dragSourceStatus === status) dropState = null;
            else
              dropState = allowedTransitions[dragSourceStatus].includes(status)
                ? 'allowed'
                : 'blocked';
          }
          return (
            <KanbanColumn
              key={status}
              status={status}
              items={grouped[status]}
              onTransition={runTransition}
              dropState={dropState}
              onDragStart={(u) => {
                dragRef.current = u;
                if (isPipelineStatus(u.status)) setDragSourceStatus(u.status);
              }}
              onDragEnd={() => {
                dragRef.current = null;
                setDragSourceStatus(null);
              }}
              onDrop={handleDrop}
            />
          );
        })}
      </div>
    </div>
  );
};
