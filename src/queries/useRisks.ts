import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { ProjectRisk } from '@/types';
import type { ProjectRiskInput } from '@/data/client/dataSource';

export const riskKeys = {
  all: ['risks'] as const,
  list: (projectId: string) => [...riskKeys.all, 'list', projectId] as const,
};

export function useRiskList(projectId: string) {
  return useQuery({
    queryKey: riskKeys.list(projectId),
    queryFn: () => dataSource.risks.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, risk }: { projectId: string; risk: ProjectRiskInput }) =>
      dataSource.risks.create(projectId, risk),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: riskKeys.list(projectId) }),
  });
}

export function useUpdateRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, riskId, changes }: { projectId: string; riskId: string; changes: Partial<ProjectRisk> }) =>
      dataSource.risks.update(projectId, riskId, changes),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: riskKeys.list(projectId) }),
  });
}

export function useDeleteRisk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, riskId }: { projectId: string; riskId: string }) =>
      dataSource.risks.delete(projectId, riskId),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: riskKeys.list(projectId) }),
  });
}

export function useAddRiskPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, riskId, file }: { projectId: string; riskId: string; file: File }) =>
      dataSource.risks.addPhoto(projectId, riskId, file),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: riskKeys.list(projectId) }),
  });
}
