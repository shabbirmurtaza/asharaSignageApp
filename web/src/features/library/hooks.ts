import { useQuery } from '@tanstack/react-query';
import {
  getSignDetail,
  listSigns,
  listSignTypes,
  type ListSignsFilters,
  type SignHistoryRow,
  type SignTypeRow,
} from './api';

const STALE = 60_000;

export const useSigns = (filters: ListSignsFilters) =>
  useQuery<SignHistoryRow[]>({
    queryKey: ['library', 'signs', filters],
    queryFn: () => listSigns(filters),
    staleTime: STALE,
  });

export const useSignDetail = (id: string | undefined) =>
  useQuery<SignHistoryRow | null>({
    queryKey: ['library', 'sign', id],
    queryFn: () => getSignDetail(id as string),
    enabled: Boolean(id),
    staleTime: STALE,
  });

export const useSignTypes = () =>
  useQuery<SignTypeRow[]>({
    queryKey: ['library', 'sign-types'],
    queryFn: listSignTypes,
    staleTime: 5 * 60_000,
  });
