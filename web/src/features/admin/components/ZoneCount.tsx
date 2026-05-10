import { useZones } from '../hooks';

export const ZoneCount = ({ venueId }: { venueId: string }) => {
  const { data } = useZones(venueId);
  return <span>{data?.length ?? 0}</span>;
};
