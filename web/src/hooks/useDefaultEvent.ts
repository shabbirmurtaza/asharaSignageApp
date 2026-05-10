import { useQuery } from '@tanstack/react-query';
import { db } from '@/lib/api';

export interface DefaultEventRow {
  id: string;
  name: string;
  year: string;
  hijri_year: string | null;
  city: string | null;
  brand_primary: string | null;
}

export const useDefaultEvent = () =>
  useQuery({
    queryKey: ['default-event'],
    queryFn: async () => {
      const rows = await db.from<DefaultEventRow>('events').select(
        'id,name,year,hijri_year,city,brand_primary',
        { is_default: 'eq.true', is_archived: 'eq.false', limit: '1' },
      );
      return rows[0] ?? null;
    },
    staleTime: 5 * 60_000,
  });
