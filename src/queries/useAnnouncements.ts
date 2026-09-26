import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { CreateAnnouncementInput } from '@/data/client/dataSource';

export const announcementKeys = {
  all: ['announcements'] as const,
  list: (propertyId?: string) => [...announcementKeys.all, 'list', propertyId] as const,
};

export function useAnnouncementList(propertyId?: string) {
  return useQuery({
    queryKey: announcementKeys.list(propertyId),
    queryFn: () => dataSource.announcements.list(propertyId),
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => dataSource.announcements.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataSource.announcements.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: announcementKeys.all }),
  });
}
