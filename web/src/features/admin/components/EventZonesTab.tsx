import { useEventVenues, useSetCmzZone, useZones } from '../hooks';

interface Props {
  eventId: string;
}

const VenueZones = ({
  venueId,
  venueName,
  venueType,
}: {
  venueId: string;
  venueName: string;
  venueType: string;
}) => {
  const { data: zones = [] } = useZones(venueId);
  const setCmz = useSetCmzZone(venueId);
  const isFasal = venueType === 'fasal_city';
  return (
    <div className="mb-4 rounded border border-border-default bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-text">{venueName}</p>
          <p className="text-[11px] text-muted">
            {venueType}
            {isFasal && ' — pick one CMZ'}
          </p>
        </div>
      </div>
      {zones.length === 0 && (
        <p className="text-[11px] text-hint">No zones defined for this venue.</p>
      )}
      <ul className="space-y-1">
        {zones.map((z) => (
          <li
            key={z.id}
            className="flex items-center justify-between rounded px-2 py-1 text-[12px] hover:bg-surface"
          >
            <span className="text-text">{z.name}</span>
            <label className="inline-flex items-center gap-1.5 text-[11px]">
              <input
                type="checkbox"
                disabled={!isFasal}
                checked={z.is_cmz}
                onChange={(e) =>
                  setCmz.mutate({ zoneId: z.id, enable: e.target.checked })
                }
              />
              CMZ
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const EventZonesTab = ({ eventId }: Props) => {
  const { data: attached = [] } = useEventVenues(eventId);
  if (attached.length === 0) {
    return (
      <p className="text-[12px] text-muted">
        Attach venues first to manage their zones.
      </p>
    );
  }
  return (
    <div>
      <p className="mb-3 text-[12px] text-muted">
        Toggle the CMZ (central main zone) for each fasal_city venue. Only one
        CMZ allowed per venue.
      </p>
      {attached.map((ev) =>
        ev.venue ? (
          <VenueZones
            key={ev.id}
            venueId={ev.venue.id}
            venueName={ev.venue.name}
            venueType={ev.venue.type}
          />
        ) : null,
      )}
    </div>
  );
};
