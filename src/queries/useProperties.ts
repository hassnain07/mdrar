import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { Property, FmUnit, PropertyDocument } from '@/types';

export const propertyKeys = {
  all: ['properties'] as const,
  list: () => [...propertyKeys.all, 'list'] as const,
  detail: (id: string) => [...propertyKeys.all, 'detail', id] as const,
};

export function usePropertyList() {
  return useQuery({
    queryKey: propertyKeys.list(),
    queryFn: () => dataSource.properties.list(),
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: () => dataSource.properties.get(id),
    enabled: !!id,
  });
}

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Property, 'id' | 'openRequests' | 'emergency'>) =>
      dataSource.properties.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: propertyKeys.list() }),
  });
}

// ---- Leases (FM units) ----
export const leaseKeys = {
  forProperty: (id: string) => ['leases', id] as const,
};

export function useLeases(propertyId: string) {
  return useQuery({
    queryKey: leaseKeys.forProperty(propertyId),
    queryFn: () => dataSource.leases.list(propertyId),
    enabled: !!propertyId,
  });
}

export function useCreateLease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof dataSource.leases.create>[0]) => dataSource.leases.create(input),
    onSuccess: (_d, input) => qc.invalidateQueries({ queryKey: leaseKeys.forProperty(input.propertyId) }),
  });
}

export function useUpdateLease(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<FmUnit> }) => dataSource.leases.update(id, changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: leaseKeys.forProperty(propertyId) }),
  });
}

// ---- Property documents ----
export const propertyDocKeys = {
  forProperty: (id: string) => ['propertyDocuments', id] as const,
};

export function usePropertyDocuments(propertyId: string) {
  return useQuery({
    queryKey: propertyDocKeys.forProperty(propertyId),
    queryFn: () => dataSource.propertyDocuments.list(propertyId),
    enabled: !!propertyId,
  });
}

export function useUploadPropertyDocument(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => dataSource.propertyDocuments.upload(propertyId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: propertyDocKeys.forProperty(propertyId) }),
  });
}

export function useDeletePropertyDocument(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => dataSource.propertyDocuments.delete(propertyId, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: propertyDocKeys.forProperty(propertyId) }),
  });
}
