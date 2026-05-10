/**
 * PostgREST calls for the production pipeline.
 * Strictly transport — no toasts, no UI side-effects.
 */

import { db } from '@/lib/api';
import type { Status } from '@/lib/rbac';
import type { SignType } from '@/components/TypeBadge';

export interface PipelineUsage {
  id: string;
  event_id: string;
  venue_id: string | null;
  zone_id: string | null;
  department_id: string;
  sign_id: string;
  size_id: string | null;
  qty: number;
  status: Status;
  updated_at: string;
  created_at: string;
  sign: {
    canonical_name: string;
    sign_type: { name: SignType } | null;
  } | null;
  size: { label: string } | null;
  department: { name: string } | null;
  venue: { name: string } | null;
  zone: { name: string } | null;
}

const SELECT =
  '*,sign:signs(canonical_name,sign_type:sign_types(name)),size:sizes(label),department:departments(name),venue:venues(name),zone:zones(name)';

export const listPipeline = async (
  eventId: string,
): Promise<PipelineUsage[]> =>
  db.from<PipelineUsage>('usages').select(SELECT, {
    event_id: `eq.${eventId}`,
    status: 'in.(approved,designing,printing,ready)',
    order: 'updated_at.desc',
  });

export const transitionStatus = async (
  usageId: string,
  newStatus: Status,
): Promise<PipelineUsage[]> =>
  db
    .from<PipelineUsage>('usages')
    .update({ status: newStatus }, { id: `eq.${usageId}` });
