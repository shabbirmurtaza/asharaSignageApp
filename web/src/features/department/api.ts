/**
 * Department HOD API layer (PostgREST).
 * HTTP-only — no UI, no toast, no navigation.
 */

import { db } from '@/lib/api';
import type { Status } from '@/lib/rbac';
import type { SignType } from '@/components/TypeBadge';

// ---------- Row shapes returned by /usages with embeds ----------

export interface UsageRow {
  id: string;
  group_id: string | null;
  sign_id: string;
  department_id: string;
  event_id: string;
  venue_id: string;
  zone_id: string | null;
  size_id: string | null;
  qty: number;
  status: Status;
  rejection_note?: string | null;
  notes?: string | null;
  submitted_at?: string | null;
  created_at: string;
  created_by?: string | null;
  sign?: {
    canonical_name: string;
    sign_type?: { name: SignType } | null;
  } | null;
  size?: { id: string; label?: string | null } | null;
  event?: { id: string; name: string } | null;
  venue?: { id: string; name: string } | null;
  zone?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
}

export interface SignSummary {
  id: string;
  canonical_name: string;
  sign_type?: { id: string; name: SignType } | null;
}

export interface SizeRow {
  id: string;
  name?: string | null;
  label?: string | null;
  width: number;
  height: number;
  sqft?: number | null;
}

export interface SignTypeRow {
  id: string;
  name: SignType;
  description?: string | null;
  colour_iso?: string | null;
  is_iso: boolean;
  display_order: number;
}

export interface UsageStatusHistoryRow {
  id: string;
  usage_id: string;
  from_status: Status | null;
  to_status: Status;
  changed_by?: string | null;
  changed_by_name?: string | null;
  comment?: string | null;
  changed_at: string;
}

// ---------- Inputs ----------

export interface SubmitOrderInput {
  eventId: string;
  venueId: string;
  zoneId?: string | null;
  departmentId: string;
  signId: string;
  sizeId?: string | null;
  quantity: number;
  notes?: string | null;
  submittedBy: string;
}

export interface SubmitNewSignAndOrderInput {
  eventId: string;
  venueId: string;
  zoneId?: string | null;
  departmentId: string;
  signTypeId: string;
  canonicalName: string;
  descriptionLisan?: string | null;
  sizeId?: string | null;
  quantity: number;
  notes?: string | null;
}

const USAGE_SELECT =
  '*,sign:signs(canonical_name,sign_type:sign_types(name)),size:sizes(id,label),event:events(id,name),venue:venues(id,name),zone:zones(id,name),department:departments(id,name)';

// ---------- Read fns ----------

export const listMyRequests = (userId: string): Promise<UsageRow[]> =>
  db.from<UsageRow>('usages').select(USAGE_SELECT, {
    created_by: `eq.${userId}`,
    order: 'created_at.desc',
  });

export const getUsageDetail = async (usageId: string): Promise<{
  usage: UsageRow;
  history: UsageStatusHistoryRow[];
}> => {
  const [rows, history] = await Promise.all([
    db.from<UsageRow>('usages').select(USAGE_SELECT, {
      id: `eq.${usageId}`,
      limit: '1',
    }),
    db.from<UsageStatusHistoryRow>('usage_status_history').select('*', {
      usage_id: `eq.${usageId}`,
      order: 'changed_at.asc',
    }),
  ]);
  if (!rows[0]) throw new Error('Usage not found');
  return { usage: rows[0], history };
};

export const cancelUsage = async (usageId: string): Promise<UsageRow> => {
  const rows = await db
    .from<UsageRow>('usages')
    .update({ status: 'cancelled' as Status }, { id: `eq.${usageId}` });
  if (!rows[0]) throw new Error('Cancel failed: usage not found');
  return rows[0];
};

/**
 * Pick-existing-sign submit. We don't have a single RPC for this, so we do
 * sequential inserts: usage_groups → usages. RLS still gates each step.
 * NOTE: if either side fails the other is not rolled back; consider adding a
 * `submit_existing_sign_order` Postgres RPC if this becomes a real concern.
 */
interface UsageGroupInsert {
  id: string;
  event_id: string;
  venue_id: string;
  department_id: string;
  submitted_by?: string;
  submitted_at?: string;
  notes?: string | null;
}

export const submitOrder = async (input: SubmitOrderInput): Promise<UsageRow> => {
  const groups = await db
    .from<UsageGroupInsert>('usage_groups')
    .insert({
      event_id: input.eventId,
      venue_id: input.venueId,
      department_id: input.departmentId,
      submitted_by: input.submittedBy,
      submitted_at: new Date().toISOString(),
      notes: input.notes ?? null,
    });
  const groupId = groups[0]?.id;
  if (!groupId) throw new Error('Failed to create usage group');

  const usages = await db.from<UsageRow>('usages').insert({
    group_id: groupId,
    sign_id: input.signId,
    department_id: input.departmentId,
    event_id: input.eventId,
    venue_id: input.venueId,
    zone_id: input.zoneId ?? null,
    size_id: input.sizeId ?? null,
    qty: input.quantity,
    status: 'pending' as Status,
    notes: input.notes ?? null,
    submitted_at: new Date().toISOString(),
    created_by: input.submittedBy,
  });
  if (!usages[0]) throw new Error('Failed to create usage');
  return usages[0];
};

export const submitNewSignAndOrder = async (
  input: SubmitNewSignAndOrderInput,
): Promise<string> =>
  db.rpc<string>('create_sign_and_order', {
    p_event_id: input.eventId,
    p_venue_id: input.venueId,
    p_zone_id: input.zoneId ?? null,
    p_department_id: input.departmentId,
    p_sign_type_id: input.signTypeId,
    p_canonical_name: input.canonicalName,
    p_description_lisan: input.descriptionLisan ?? null,
    p_size_id: input.sizeId ?? null,
    p_quantity: input.quantity,
    p_notes: input.notes ?? null,
  });

export const listDepartmentSigns = (
  departmentId: string,
): Promise<SignSummary[]> =>
  db
    .from<SignSummary>('signs')
    .select('id,canonical_name,sign_type:sign_types(id,name)', {
      department_id: `eq.${departmentId}`,
      order: 'canonical_name.asc',
    });

export const listSizes = (): Promise<SizeRow[]> =>
  db.from<SizeRow>('sizes').select('*', { order: 'sqft.asc' });

export const listSignTypes = (): Promise<SignTypeRow[]> =>
  db.from<SignTypeRow>('sign_types').select('*', { order: 'display_order.asc' });
