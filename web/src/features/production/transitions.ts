/**
 * Pure transition rules for the production Kanban.
 * Mirrors RLS policy in 03_rls_policies.sql for production role.
 * RLS remains the authoritative gate; this is for UX-side validation
 * (drag-drop adjacency + kebab menu actions).
 */

import type { Status } from '@/lib/rbac';

export type PipelineStatus = 'approved' | 'designing' | 'printing' | 'ready';

export const PIPELINE_COLUMNS: readonly PipelineStatus[] = [
  'approved',
  'designing',
  'printing',
  'ready',
] as const;

/**
 * Forward-only adjacency for drag-drop. We intentionally do not surface
 * backward steps (designing→approved, etc.) on the board — those exist in
 * RLS but belong in a per-card action menu, not a drag gesture.
 */
export const allowedTransitions: Readonly<Record<PipelineStatus, Status[]>> = {
  approved: ['designing', 'rejected'],
  designing: ['printing'],
  printing: ['ready'],
  ready: [],
};

export const nextStatuses = (current: Status): Status[] => {
  if (current in allowedTransitions) {
    return allowedTransitions[current as PipelineStatus];
  }
  return [];
};

export const isPipelineStatus = (s: Status): s is PipelineStatus =>
  s === 'approved' || s === 'designing' || s === 'printing' || s === 'ready';

export const COLUMN_LABEL: Record<PipelineStatus, string> = {
  approved: 'Approved',
  designing: 'Designing',
  printing: 'Printing',
  ready: 'Ready',
};
