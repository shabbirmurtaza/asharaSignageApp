import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { StatusPill } from '@/components/StatusPill';
import { TypeBadge } from '@/components/TypeBadge';
import { useSignDetail } from '@/features/library/hooks';
import type { SignHistoryEntry } from '@/features/library/api';

interface EventGroup {
  event: string;
  total: number;
  rows: SignHistoryEntry[];
}

const groupByEvent = (history: SignHistoryEntry[]): EventGroup[] => {
  const map = new Map<string, EventGroup>();
  for (const row of history) {
    const key = row.event;
    const existing = map.get(key);
    if (existing) {
      existing.rows.push(row);
      existing.total += row.qty;
    } else {
      map.set(key, { event: key, total: row.qty, rows: [row] });
    }
  }
  return Array.from(map.values());
};

const sizeLabel = (h: number | null, w: number | null): string =>
  h && w ? `${w}×${h} cm` : '—';

export const SignDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: sign, isLoading, isError } = useSignDetail(id);

  const groups = useMemo(
    () => (sign ? groupByEvent(sign.history ?? []) : []),
    [sign],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (isError || !sign) {
    return (
      <EmptyState
        title="Sign not found"
        body="It may have been removed or you may not have access."
        action={
          <Link to="/library" className="text-sm text-text underline">
            Back to library
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/library"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={14} />
        Back to library
      </Link>

      <header className="flex flex-col gap-2 rounded-lg border border-border-default bg-card p-5">
        <div className="flex flex-wrap items-center gap-3">
          <TypeBadge type={sign.sign_type} />
          <span className="text-xs text-hint">
            {sign.template_id ? 'Variable' : 'Constant'}
          </span>
          <span className="inline-flex items-center rounded-full border border-border-default bg-surface px-2 py-0.5 text-xs text-muted">
            {sign.department_name}
          </span>
          <span className="ml-auto text-xs text-muted">
            Total qty all time:{' '}
            <span className="font-medium text-text">
              {sign.total_qty_all_time}
            </span>
          </span>
        </div>
        <h1 className="text-[22px] font-medium text-text">
          {sign.canonical_name}
        </h1>
        {sign.description_lisan && (
          <p dir="rtl" lang="ar" className="text-base text-muted">
            {sign.description_lisan}
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-4 text-xs text-hint">
          <span>Orders: {sign.total_orders}</span>
          <span>Years used: {sign.years_used}</span>
          {sign.last_used_year && <span>Last: {sign.last_used_year}</span>}
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Past usage
        </h2>
        {groups.length === 0 ? (
          <EmptyState
            title="No past usage"
            body="This sign hasn't been requested at any event yet."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {groups.map((g) => (
              <EventAccordion key={g.event} group={g} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface AccordionProps {
  group: EventGroup;
}

const EventAccordion = ({ group }: AccordionProps) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-lg border border-border-default bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-text">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          {group.event}
        </span>
        <span className="text-xs text-muted">
          {group.rows.length} usage{group.rows.length === 1 ? '' : 's'} · qty{' '}
          {group.total}
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto border-t border-border-default">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[11px] uppercase tracking-wide text-hint">
              <tr>
                <th className="px-4 py-2 font-medium">Venue</th>
                <th className="px-4 py-2 font-medium">Zone</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="px-4 py-2 font-medium">Qty</th>
                <th className="px-4 py-2 font-medium">Size</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r, i) => (
                <tr
                  key={i}
                  className="border-t border-border-default text-text"
                >
                  <td className="px-4 py-2">{r.venue ?? '—'}</td>
                  <td className="px-4 py-2 text-muted">{r.zone ?? '—'}</td>
                  <td className="px-4 py-2">{r.department}</td>
                  <td className="px-4 py-2">{r.qty}</td>
                  <td className="px-4 py-2 text-muted">
                    {sizeLabel(r.height, r.width)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
