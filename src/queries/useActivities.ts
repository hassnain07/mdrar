import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { ProjectActivity } from '@/types';
import type { ProjectActivityInput } from '@/data/client/dataSource';

export const activityKeys = {
  all: ['activities'] as const,
  list: (projectId: string) => [...activityKeys.all, 'list', projectId] as const,
};

export function useActivityList(projectId: string) {
  return useQuery({
    queryKey: activityKeys.list(projectId),
    queryFn: () => dataSource.activities.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, activity }: { projectId: string; activity: ProjectActivityInput }) =>
      dataSource.activities.create(projectId, activity),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: activityKeys.list(projectId) }),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, activityId, changes }: { projectId: string; activityId: string; changes: Partial<ProjectActivity> }) =>
      dataSource.activities.update(projectId, activityId, changes),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: activityKeys.list(projectId) }),
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, activityId }: { projectId: string; activityId: string }) =>
      dataSource.activities.delete(projectId, activityId),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: activityKeys.list(projectId) }),
  });
}

export function useAddActivityPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, activityId, file }: { projectId: string; activityId: string; file: File }) =>
      dataSource.activities.addPhoto(projectId, activityId, file),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: activityKeys.list(projectId) }),
  });
}
