/**
 * Signage HOD API surface — thin wrapper over PostgREST.
 *
 * RLS enforces venue-scoped visibility & approval rights; the helpers
 * here just shape selects/filters and accept already-validated input
 * from the React layer.
 */

import { db } from '@/lib/api';
import type { Status } from '@/lib/rbac';

export type UsageStatus = Status;

const USAGE_SELECT =
  '*,sign:signs(canonical_name,sign_type:sign_types(name)),size:sizes(label),' +
  'department:departments(name,name_lisan),user_groups:usage_groups(id),' +
  'created_by_user:users!created_by(its_number,name)';

export interface HodUsageRow {
  id: string;
  group_id: string | null;
  sign_id: string;
  department_id: string;
  event_id: string;
  venue_id: string;
  zone_id: string | null;
  size_id: string | null;
  qty: number;
  status: UsageStatus;
  rejection_note: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  sign: {
    canonical_name: string;
    sign_type: { name: string } | null;
  } | null;
  size: { label: string | null } | null;
  department: { name: string; name_lisan: string | null } | null;
  user_groups: { id: string }[] | null;
  created_by_user: { its_number: string; name: string } | null;
}

export const listVenuePending = async (
  eventId: string,
  venueId: string,
): Promise<HodUsageRow[]> =>
  db.from<HodUsageRow>('usages').select(USAGE_SELECT, {
    status: 'eq.pending',
    event_id: `eq.${eventId}`,
    venue_id: `eq.${venueId}`,
    order: 'created_at.desc',
  });

export const listVenueAll = async (
  eventId: string,
  venueId: string,
  statusFilter?: UsageStatus,
): Promise<HodUsageRow[]> => {
  const params: Record<string, string> = {
    event_id: `eq.${eventId}`,
    venue_id: `eq.${venueId}`,
    order: 'created_at.desc',
  };
  if (statusFilter) params.status = `eq.${statusFilter}`;
  return db.from<HodUsageRow>('usages').select(USAGE_SELECT, params);
};

export const approveUsage = async (id: string): Promise<HodUsageRow[]> =>
  db.from<HodUsageRow>('usages').update(
    { status: 'approved' },
    { id: `eq.${id}` },
  );

export const rejectUsage = async (
  id: string,
  note: string,
): Promise<HodUsageRow[]> =>
  db.from<HodUsageRow>('usages').update(
    { status: 'rejected', rejection_note: note },
    { id: `eq.${id}` },
  );

/**
 * PostgREST permits batch update by IN-list filter; this hits the table
 * once and lets RLS reject any row the caller can't touch.
 */
export const bulkApprove = async (ids: string[]): Promise<HodUsageRow[]> => {
  if (ids.length === 0) return [];
  return db.from<HodUsageRow>('usages').update(
    { status: 'approved' },
    { id: `in.(${ids.join(',')})` },
  );
};

// ============================================================
// Place order on behalf of a department
// ============================================================
export interface PlaceOrderInput {
  eventId: string;
  venueId: string;
  zoneId?: string | null;
  departmentId: string;
  signId: string;
  sizeId?: string | null;
  qty: number;
  notes?: string | null;
}

interface UsageGroupRow {
  id: string;
  event_id: string;
  venue_id: string;
  department_id: string;
  submitted_by: string | null;
  hod_name: string | null;
  notes: string | null;
  submitted_at: string | null;
}

interface UsageInsertRow {
  id: string;
  status: UsageStatus;
  group_id?: string | null;
  sign_id?: string;
  department_id?: string;
  event_id?: string;
  venue_id?: string;
  zone_id?: string | null;
  size_id?: string | null;
  qty?: number;
  notes?: string | null;
  submitted_at?: string | null;
}

export const placeOrderOnBehalf = async (
  input: PlaceOrderInput,
): Promise<UsageInsertRow> => {
  // 1. Open a usage_group bundle for this submission
  const groups = await db.from<UsageGroupRow>('usage_groups').insert({
    event_id: input.eventId,
    venue_id: input.venueId,
    department_id: input.departmentId,
    submitted_at: new Date().toISOString(),
    notes: input.notes ?? null,
  });
  const group = groups[0];
  if (!group) throw new Error('Failed to create usage group');

  // 2. Insert the usage row tied to the group
  const usages = await db.from<UsageInsertRow>('usages').insert({
    group_id: group.id,
    sign_id: input.signId,
    department_id: input.departmentId,
    event_id: input.eventId,
    venue_id: input.venueId,
    zone_id: input.zoneId ?? null,
    size_id: input.sizeId ?? null,
    qty: input.qty,
    notes: input.notes ?? null,
    status: 'pending',
    submitted_at: new Date().toISOString(),
  });
  const usage = usages[0];
  if (!usage) throw new Error('Failed to create usage');
  return usage;
};

// ============================================================
// Catalogue maintenance — add a sign without ordering it
// ============================================================
export interface CreateSignInput {
  canonicalName: string;
  descriptionLisan?: string | null;
  signTypeId: string;
  departmentId: string;
}

export interface SignRow {
  id: string;
  canonical_name: string;
  description_lisan: string | null;
  sign_type_id: string;
  department_id: string;
  template_id: string | null;
  created_at: string;
}

export const createSignDirectly = async (
  input: CreateSignInput,
): Promise<SignRow> => {
  const rows = await db.from<SignRow>('signs').insert({
    canonical_name: input.canonicalName,
    description_lisan: input.descriptionLisan ?? null,
    sign_type_id: input.signTypeId,
    department_id: input.departmentId,
  });
  const row = rows[0];
  if (!row) throw new Error('Failed to create sign');
  return row;
};

// ============================================================
// Lookups for the on-behalf form
// ============================================================
export interface SignTypeRow {
  id: string;
  name: string;
  description: string | null;
  is_iso: boolean;
  display_order: number | null;
}

export const listSignTypes = async (): Promise<SignTypeRow[]> =>
  db.from<SignTypeRow>('sign_types').select('*', {
    order: 'display_order.asc.nullslast,name.asc',
  });

export interface DepartmentRow {
  id: string;
  name: string;
  name_lisan: string | null;
}

export const listDepartments = async (): Promise<DepartmentRow[]> =>
  db.from<DepartmentRow>('departments').select('id,name,name_lisan', {
    order: 'name.asc',
  });

export interface VenueRow {
  id: string;
  name: string;
  type: string;
}

export const getVenue = async (venueId: string): Promise<VenueRow | null> => {
  const rows = await db.from<VenueRow>('venues').select('id,name,type', {
    id: `eq.${venueId}`,
  });
  return rows[0] ?? null;
};

export interface EventRow {
  id: string;
  name: string;
  year: string;
  city: string;
  brand_primary: string | null;
  hijri_year: string | null;
}

export const getEvent = async (eventId: string): Promise<EventRow | null> => {
  const rows = await db.from<EventRow>('events').select(
    'id,name,year,city,brand_primary,hijri_year',
    { id: `eq.${eventId}` },
  );
  return rows[0] ?? null;
};

export interface ZoneRow {
  id: string;
  name: string;
  is_cmz: boolean;
}

export const listZones = async (venueId: string): Promise<ZoneRow[]> =>
  db.from<ZoneRow>('zones').select('id,name,is_cmz', {
    venue_id: `eq.${venueId}`,
    order: 'name.asc',
  });

export interface SizeRow {
  id: string;
  label: string | null;
  height: number;
  width: number;
}

export const listSizes = async (): Promise<SizeRow[]> =>
  db.from<SizeRow>('sizes').select('id,label,height,width', {
    order: 'sqft.asc',
  });

export const searchSigns = async (q: string): Promise<SignRow[]> => {
  const params: Record<string, string> = {
    order: 'canonical_name.asc',
    limit: '50',
  };
  if (q.trim()) params.canonical_name = `ilike.*${q.trim()}*`;
  return db.from<SignRow>('signs').select(
    'id,canonical_name,description_lisan,sign_type_id,template_id,created_at',
    params,
  );
};

// ============================================================
// Recent activity & KPIs for the dashboard
// ============================================================
export interface StatusCounts {
  pending: number;
  approved: number;
  designing: number;
  printing: number;
  ready: number;
  rejected: number;
  cancelled: number;
}

const ZERO_COUNTS: StatusCounts = {
  pending: 0,
  approved: 0,
  designing: 0,
  printing: 0,
  ready: 0,
  rejected: 0,
  cancelled: 0,
};

export const getVenueStatusCounts = async (
  eventId: string,
  venueId: string,
): Promise<StatusCounts> => {
  // PostgREST has no `group by` on tables; we pull only the status col
  // and fold client-side. Cheap because rows are venue-scoped already.
  const rows = await db.from<{ status: keyof StatusCounts }>('usages').select(
    'status',
    {
      event_id: `eq.${eventId}`,
      venue_id: `eq.${venueId}`,
    },
  );
  const out: StatusCounts = { ...ZERO_COUNTS };
  for (const r of rows) {
    if (r.status in out) out[r.status] += 1;
  }
  return out;
};

export interface ActivityRow {
  id: string;
  usage_id: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
  changed_by_name: string | null;
  comment: string | null;
  usage: {
    id: string;
    qty: number;
    venue_id: string;
    department: { name: string } | null;
    sign: { canonical_name: string } | null;
  } | null;
}

export const listVenueActivity = async (
  eventId: string,
  venueId: string,
  limit = 10,
): Promise<ActivityRow[]> => {
  // Embed usages so we can filter by venue+event on the parent.
  const rows = await db.from<ActivityRow>('usage_status_history').select(
    '*,usage:usages!inner(id,qty,venue_id,event_id,department:departments(name),sign:signs(canonical_name))',
    {
      'usage.event_id': `eq.${eventId}`,
      'usage.venue_id': `eq.${venueId}`,
      order: 'changed_at.desc',
      limit: String(limit),
    },
  );
  return rows;
};
