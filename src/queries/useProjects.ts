import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { ProjectUnit, UnitInstance } from '@/types';
import type { CreateProjectInput, ProjectUnitInput, UnitInstanceInput } from '@/data/client/dataSource';

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

export function useProjectList() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => dataSource.projects.list(),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => dataSource.projects.get(id),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => dataSource.projects.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Parameters<typeof dataSource.projects.update>[1] }) =>
      dataSource.projects.update(id, changes),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
      qc.invalidateQueries({ queryKey: projectKeys.list() });
    },
  });
}

export function useAddUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, unit }: { projectId: string; unit: ProjectUnitInput }) =>
      dataSource.projects.addUnit(projectId, unit),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useUpdateUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, unitId, changes }: { projectId: string; unitId: string; changes: Partial<ProjectUnit> }) =>
      dataSource.projects.updateUnit(projectId, unitId, changes),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useDeleteUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, unitId }: { projectId: string; unitId: string }) =>
      dataSource.projects.deleteUnit(projectId, unitId),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useAddUnitInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, unit }: { projectId: string; unit: UnitInstanceInput }) =>
      dataSource.projects.addUnitInstance(projectId, unit),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useUpdateUnitInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, unitId, changes }: { projectId: string; unitId: string; changes: Partial<UnitInstance> }) =>
      dataSource.projects.updateUnitInstance(projectId, unitId, changes),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}

export function useDeleteUnitInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, unitId }: { projectId: string; unitId: string }) =>
      dataSource.projects.deleteUnitInstance(projectId, unitId),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) }),
  });
}
