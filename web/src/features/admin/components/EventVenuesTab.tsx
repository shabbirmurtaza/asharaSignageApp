import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import {
  useAttachVenueToEvent,
  useDetachVenueFromEvent,
  useEventVenues,
  useVenues,
} from '../hooks';
import { Button } from './Button';

interface Props {
  eventId: string;
}

export const EventVenuesTab = ({ eventId }: Props) => {
  const { data: attached = [] } = useEventVenues(eventId);
  const { data: allVenues = [] } = useVenues();
  const attach = useAttachVenueToEvent(eventId);
  const detach = useDetachVenueFromEvent(eventId);

  const attachedIds = useMemo(
    () => new Set(attached.map((ev) => ev.venue_id)),
    [attached],
  );
  const candidates = useMemo(
    () => allVenues.filter((v) => !attachedIds.has(v.id)),
    [allVenues, attachedIds],
  );

  return (
    <div>
      <p className="mb-2 text-[12px] text-muted">
        Venues currently attached to this event. Detaching does NOT delete the
        venue from the master list.
      </p>
      <ul className="mb-4 space-y-1.5">
        {attached.length === 0 && (
          <li className="rounded border border-dashed border-border-default px-3 py-2 text-[12px] text-hint">
            No venues attached yet.
          </li>
        )}
        {attached.map((ev) => (
          <li
            key={ev.id}
            className="flex items-center justify-between rounded border border-border-default bg-card px-3 py-2 text-[13px]"
          >
            <div>
              <p className="font-medium text-text">{ev.venue?.name}</p>
              <p className="text-[11px] text-muted">
                {ev.venue?.type} {ev.venue?.city ? `• ${ev.venue.city}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => detach.mutate(ev.venue_id)}
              className="rounded p-1.5 text-muted hover:bg-surface hover:text-danger"
              aria-label="Detach venue"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-1 text-[12px] font-medium text-text">Attach venue</p>
        <div className="flex flex-wrap gap-1.5">
          {candidates.length === 0 && (
            <span className="text-[12px] text-hint">No venues available.</span>
          )}
          {candidates.map((v) => (
            <Button
              key={v.id}
              size="sm"
              onClick={() => attach.mutate(v.id)}
              disabled={attach.isPending}
            >
              {v.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
