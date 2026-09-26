import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { IpcEntry } from '@/types';
import type { IpcEntryInput } from '@/data/client/dataSource';

export const ipcKeys = {
  all: ['ipc'] as const,
  list: (projectId: string) => [...ipcKeys.all, 'list', projectId] as const,
};

export function useIpcList(projectId: string) {
  return useQuery({
    queryKey: ipcKeys.list(projectId),
    queryFn: () => dataSource.ipc.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateIpc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, entry }: { projectId: string; entry: IpcEntryInput }) =>
      dataSource.ipc.create(projectId, entry),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: ipcKeys.list(projectId) }),
  });
}

export function useUpdateIpc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, entryId, changes }: { projectId: string; entryId: string; changes: Partial<IpcEntry> }) =>
      dataSource.ipc.update(projectId, entryId, changes),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: ipcKeys.list(projectId) }),
  });
}

export function useDeleteIpc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, entryId }: { projectId: string; entryId: string }) =>
      dataSource.ipc.delete(projectId, entryId),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: ipcKeys.list(projectId) }),
  });
}

export function useAddIpcAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, entryId, file }: { projectId: string; entryId: string; file: File }) =>
      dataSource.ipc.addAttachment(projectId, entryId, file),
    onSuccess: (_data, { projectId }) => qc.invalidateQueries({ queryKey: ipcKeys.list(projectId) }),
  });
}
