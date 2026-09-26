import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { RequestStatus, TimelineEvent } from '@/types';
import type { CreateRequestInput } from '@/data/client/dataSource';

export const requestKeys = {
  all: ['requests'] as const,
  list: (filters?: { propertyId?: string; status?: RequestStatus; tenantId?: string }) =>
    [...requestKeys.all, 'list', filters] as const,
  detail: (id: string) => [...requestKeys.all, 'detail', id] as const,
};

export function useRequestList(filters?: { propertyId?: string; status?: RequestStatus; tenantId?: string; technicianId?: string }) {
  return useQuery({
    queryKey: requestKeys.list(filters),
    queryFn: () => dataSource.requests.list(filters),
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: requestKeys.detail(id),
    queryFn: () => dataSource.requests.get(id),
    enabled: !!id,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRequestInput) => dataSource.requests.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: requestKeys.all }),
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Parameters<typeof dataSource.requests.update>[1] }) =>
      dataSource.requests.update(id, changes),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: requestKeys.all });
      qc.invalidateQueries({ queryKey: requestKeys.detail(id) });
    },
  });
}

export function useAddTimelineEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, event }: { id: string; event: Omit<TimelineEvent, 'id'> }) =>
      dataSource.requests.addTimelineEvent(id, event),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: requestKeys.detail(id) });
      qc.invalidateQueries({ queryKey: requestKeys.all });
    },
  });
}
