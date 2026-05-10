/**
 * Sign Library API.
 *
 * Reads from `sign_history` view (full sign + aggregated usage history)
 * and `sign_types` lookup table. RLS allows all authenticated users to
 * SELECT both, so no scope filters needed beyond user-supplied filters.
 */
import { db } from '@/lib/api';
import type { SignType } from '@/components/TypeBadge';
import type { Status } from '@/lib/rbac';

export interface SignHistoryEntry {
  event: string;
  venue: string | null;
  zone: string | null;
  department: string;
  qty: number;
  status: Status;
  height: number | null;
  width: number | null;
}

export interface SignHistoryRow {
  id: string;
  canonical_name: string;
  template_id: string | null;
  template_display_name: string | null;
  sign_type: SignType;
  description_lisan: string | null;
  description_arabic: string | null;
  slot_values: Record<string, string> | null;
  department_id: string;
  department_name: string;
  department_name_lisan: string | null;
  years_used: number;
  total_orders: number;
  total_qty_all_time: number;
  last_used_year: number | null;
  history: SignHistoryEntry[];
}

export interface SignTypeRow {
  id: string;
  name: SignType;
  description: string | null;
  colour_iso: string | null;
  is_iso: boolean;
  display_order: number;
}

export type VariableFilter = 'all' | 'variable' | 'constant';

export interface ListSignsFilters {
  /** Filter by sign_type name (e.g. 'prohibition'). The view exposes the name,
   *  not the uuid, so we filter on names directly. */
  signTypeNames?: SignType[];
  variable?: VariableFilter;
  search?: string;
  /** Restrict to signs owned by this department. department_user sessions
   *  must always set this to their own dept id. */
  departmentId?: string | null;
}

export const listSigns = async (
  filters: ListSignsFilters = {},
): Promise<SignHistoryRow[]> => {
  const params: Record<string, string> = {
    order: 'canonical_name.asc',
  };

  if (filters.signTypeNames && filters.signTypeNames.length > 0) {
    params.sign_type = `in.(${filters.signTypeNames.join(',')})`;
  }

  if (filters.variable === 'variable') {
    params.template_id = 'not.is.null';
  } else if (filters.variable === 'constant') {
    params.template_id = 'is.null';
  }

  if (filters.search && filters.search.trim().length > 0) {
    const q = filters.search.trim().replace(/[*%]/g, '');
    params.canonical_name = `ilike.*${q}*`;
  }

  if (filters.departmentId) {
    params.department_id = `eq.${filters.departmentId}`;
  }

  return db.from<SignHistoryRow>('sign_history').select('*', params);
};

export const getSignDetail = async (
  signId: string,
): Promise<SignHistoryRow | null> => {
  const rows = await db
    .from<SignHistoryRow>('sign_history')
    .select('*', { id: `eq.${signId}`, limit: '1' });
  return rows[0] ?? null;
};

export const listSignTypes = async (): Promise<SignTypeRow[]> =>
  db.from<SignTypeRow>('sign_types').select('*', { order: 'display_order.asc' });
