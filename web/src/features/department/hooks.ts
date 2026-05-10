import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  cancelUsage,
  getUsageDetail,
  listDepartmentSigns,
  listMyRequests,
  listSignTypes,
  listSizes,
  submitNewSignAndOrder,
  submitOrder,
  type SubmitNewSignAndOrderInput,
  type SubmitOrderInput,
} from './api';

const KEYS = {
  myRequests: (userId: string) => ['my-requests', userId] as const,
  usageDetail: (id: string) => ['usage', id] as const,
  signs: (deptId: string) => ['dept-signs', deptId] as const,
  sizes: ['sizes'] as const,
  signTypes: ['sign-types'] as const,
};

export const useMyRequests = (userId: string | undefined) =>
  useQuery({
    queryKey: KEYS.myRequests(userId ?? ''),
    queryFn: () => listMyRequests(userId as string),
    enabled: !!userId,
  });

export const useUsageDetail = (usageId: string | undefined) =>
  useQuery({
    queryKey: KEYS.usageDetail(usageId ?? ''),
    queryFn: () => getUsageDetail(usageId as string),
    enabled: !!usageId,
  });

export const useCancelUsage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (usageId: string) => cancelUsage(usageId),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ['my-requests'] });
      qc.invalidateQueries({ queryKey: KEYS.usageDetail(row.id) });
    },
  });
};

export const useSubmitOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitOrderInput) => submitOrder(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-requests'] }),
  });
};

export const useSubmitNewSignAndOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitNewSignAndOrderInput) =>
      submitNewSignAndOrder(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-requests'] }),
  });
};

export const useDepartmentSigns = (departmentId: string | undefined) =>
  useQuery({
    queryKey: KEYS.signs(departmentId ?? ''),
    queryFn: () => listDepartmentSigns(departmentId as string),
    enabled: !!departmentId,
    staleTime: 5 * 60 * 1000,
  });

export const useSizes = () =>
  useQuery({
    queryKey: KEYS.sizes,
    queryFn: listSizes,
    staleTime: 60 * 60 * 1000,
  });

export const useSignTypes = () =>
  useQuery({
    queryKey: KEYS.signTypes,
    queryFn: listSignTypes,
    staleTime: 60 * 60 * 1000,
  });
