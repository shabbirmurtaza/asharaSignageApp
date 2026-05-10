/**
 * TanStack Query hooks for the Signage HOD feature tree.
 * Mutations invalidate the venue-scoped pending and all-status queries.
 */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  approveUsage,
  bulkApprove,
  createSignDirectly,
  getEvent,
  getVenue,
  getVenueStatusCounts,
  listDepartments,
  listSignTypes,
  listSizes,
  listVenueActivity,
  listVenueAll,
  listVenuePending,
  listZones,
  placeOrderOnBehalf,
  rejectUsage,
  searchSigns,
  type CreateSignInput,
  type PlaceOrderInput,
  type UsageStatus,
} from './api';

const KEYS = {
  pending: (e: string, v: string) => ['hod-pending', e, v] as const,
  all: (e: string, v: string, s?: UsageStatus) =>
    ['hod-all', e, v, s ?? 'any'] as const,
  counts: (e: string, v: string) => ['hod-counts', e, v] as const,
  activity: (e: string, v: string) => ['hod-activity', e, v] as const,
  event: (e: string) => ['hod-event', e] as const,
  venue: (v: string) => ['hod-venue', v] as const,
  zones: (v: string) => ['hod-zones', v] as const,
  signTypes: ['hod-sign-types'] as const,
  departments: ['hod-departments'] as const,
  sizes: ['hod-sizes'] as const,
  signSearch: (q: string) => ['hod-sign-search', q] as const,
};

const useInvalidateVenue = (eventId?: string, venueId?: string) => {
  const qc = useQueryClient();
  return () => {
    if (!eventId || !venueId) {
      qc.invalidateQueries({ queryKey: ['hod-pending'] });
      qc.invalidateQueries({ queryKey: ['hod-all'] });
      qc.invalidateQueries({ queryKey: ['hod-counts'] });
      qc.invalidateQueries({ queryKey: ['hod-activity'] });
      return;
    }
    qc.invalidateQueries({ queryKey: KEYS.pending(eventId, venueId) });
    qc.invalidateQueries({ queryKey: ['hod-all', eventId, venueId] });
    qc.invalidateQueries({ queryKey: KEYS.counts(eventId, venueId) });
    qc.invalidateQueries({ queryKey: KEYS.activity(eventId, venueId) });
  };
};

export const useVenuePending = (eventId?: string, venueId?: string) =>
  useQuery({
    queryKey: KEYS.pending(eventId ?? '', venueId ?? ''),
    queryFn: () => listVenuePending(eventId as string, venueId as string),
    enabled: !!eventId && !!venueId,
  });

export const useVenueAll = (
  eventId?: string,
  venueId?: string,
  statusFilter?: UsageStatus,
) =>
  useQuery({
    queryKey: KEYS.all(eventId ?? '', venueId ?? '', statusFilter),
    queryFn: () =>
      listVenueAll(eventId as string, venueId as string, statusFilter),
    enabled: !!eventId && !!venueId,
  });

export const useVenueStatusCounts = (eventId?: string, venueId?: string) =>
  useQuery({
    queryKey: KEYS.counts(eventId ?? '', venueId ?? ''),
    queryFn: () => getVenueStatusCounts(eventId as string, venueId as string),
    enabled: !!eventId && !!venueId,
  });

export const useVenueActivity = (eventId?: string, venueId?: string) =>
  useQuery({
    queryKey: KEYS.activity(eventId ?? '', venueId ?? ''),
    queryFn: () => listVenueActivity(eventId as string, venueId as string, 10),
    enabled: !!eventId && !!venueId,
  });

export const useVenue = (venueId?: string) =>
  useQuery({
    queryKey: KEYS.venue(venueId ?? ''),
    queryFn: () => getVenue(venueId as string),
    enabled: !!venueId,
  });

export const useEvent = (eventId?: string) =>
  useQuery({
    queryKey: KEYS.event(eventId ?? ''),
    queryFn: () => getEvent(eventId as string),
    enabled: !!eventId,
  });

export const useZones = (venueId?: string) =>
  useQuery({
    queryKey: KEYS.zones(venueId ?? ''),
    queryFn: () => listZones(venueId as string),
    enabled: !!venueId,
  });

export const useSignTypes = () =>
  useQuery({ queryKey: KEYS.signTypes, queryFn: listSignTypes });

export const useDepartments = () =>
  useQuery({ queryKey: KEYS.departments, queryFn: listDepartments });

export const useSizes = () =>
  useQuery({ queryKey: KEYS.sizes, queryFn: listSizes });

export const useSignSearch = (q: string, enabled = true) =>
  useQuery({
    queryKey: KEYS.signSearch(q),
    queryFn: () => searchSigns(q),
    enabled,
  });

export const useApproveUsage = (eventId?: string, venueId?: string) => {
  const invalidate = useInvalidateVenue(eventId, venueId);
  return useMutation({
    mutationFn: (id: string) => approveUsage(id),
    onSuccess: invalidate,
  });
};

export const useRejectUsage = (eventId?: string, venueId?: string) => {
  const invalidate = useInvalidateVenue(eventId, venueId);
  return useMutation({
    mutationFn: (vars: { id: string; note: string }) =>
      rejectUsage(vars.id, vars.note),
    onSuccess: invalidate,
  });
};

export const useBulkApprove = (eventId?: string, venueId?: string) => {
  const invalidate = useInvalidateVenue(eventId, venueId);
  return useMutation({
    mutationFn: (ids: string[]) => bulkApprove(ids),
    onSuccess: invalidate,
  });
};

export const usePlaceOrderOnBehalf = (eventId?: string, venueId?: string) => {
  const invalidate = useInvalidateVenue(eventId, venueId);
  return useMutation({
    mutationFn: (input: PlaceOrderInput) => placeOrderOnBehalf(input),
    onSuccess: invalidate,
  });
};

export const useCreateSignDirectly = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSignInput) => createSignDirectly(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hod-sign-search'] });
    },
  });
};
