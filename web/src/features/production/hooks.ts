/**
 * TanStack Query hooks for the production pipeline.
 * - Polls every 15s so HOD-side approvals appear without manual refresh.
 * - Optimistic update on transition; reconciles via invalidate on settle.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import type { Status } from '@/lib/rbac';
import { listPipeline, transitionStatus, type PipelineUsage } from './api';

const pipelineKey = (eventId: string) => ['pipeline', eventId] as const;

export const usePipeline = (eventId: string | null) =>
  useQuery({
    queryKey: pipelineKey(eventId ?? '_'),
    queryFn: () => listPipeline(eventId as string),
    enabled: !!eventId,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

export interface TransitionVars {
  id: string;
  from: Status;
  to: Status;
}

export interface TransitionContext {
  prev: PipelineUsage[] | undefined;
}

export const useTransition = (
  eventId: string | null,
): UseMutationResult<unknown, ApiError, TransitionVars, TransitionContext> => {
  const qc = useQueryClient();
  const key = pipelineKey(eventId ?? '_');

  return useMutation<unknown, ApiError, TransitionVars, TransitionContext>({
    mutationFn: ({ id, to }) => transitionStatus(id, to),
    onMutate: async ({ id, to }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<PipelineUsage[]>(key);
      if (prev) {
        qc.setQueryData<PipelineUsage[]>(
          key,
          prev.map((u) =>
            u.id === id
              ? { ...u, status: to, updated_at: new Date().toISOString() }
              : u,
          ),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key });
    },
  });
};
