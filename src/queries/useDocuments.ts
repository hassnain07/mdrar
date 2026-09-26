import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { ProjectDocument } from '@/types';

export const documentKeys = {
  all: ['documents'] as const,
  list: (projectId: string) => [...documentKeys.all, 'list', projectId] as const,
  categories: (projectId: string) => [...documentKeys.all, 'categories', projectId] as const,
};

export function useDocumentList(projectId: string) {
  return useQuery({
    queryKey: documentKeys.list(projectId),
    queryFn: () => dataSource.documents.list(projectId),
    enabled: !!projectId,
  });
}

export function useDocumentCategories(projectId: string) {
  return useQuery({
    queryKey: documentKeys.categories(projectId),
    queryFn: () => dataSource.documents.listCategories(projectId),
    enabled: !!projectId,
  });
}

export function useUploadDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, file, categoryId }: { projectId: string; file: File; categoryId: string }) =>
      dataSource.documents.upload(projectId, file, categoryId),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: documentKeys.list(projectId) }),
  });
}

export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, categoryId, doc }: { projectId: string; categoryId: string; doc: { name: string; nameEn: string; type: string; uploadDate: string } }) =>
      dataSource.documents.create(projectId, categoryId, doc),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: documentKeys.list(projectId) }),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, documentId, changes }: { projectId: string; documentId: string; changes: Partial<Pick<ProjectDocument, 'name' | 'nameEn' | 'categoryId'>> }) =>
      dataSource.documents.update(projectId, documentId, changes),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: documentKeys.list(projectId) }),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, documentId }: { projectId: string; documentId: string }) =>
      dataSource.documents.delete(projectId, documentId),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: documentKeys.list(projectId) }),
  });
}

export function useRenameDocumentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, categoryId, names }: { projectId: string; categoryId: string; names: { name: string; nameEn: string } }) =>
      dataSource.documents.renameCategory(projectId, categoryId, names),
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: documentKeys.categories(projectId) });
      qc.invalidateQueries({ queryKey: documentKeys.list(projectId) });
    },
  });
}

export function useAddDocumentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, names }: { projectId: string; names: { name: string; nameEn: string } }) =>
      dataSource.documents.addCategory(projectId, names),
    onSuccess: (_d, { projectId }) => qc.invalidateQueries({ queryKey: documentKeys.categories(projectId) }),
  });
}

export function useRemoveDocumentCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, categoryId }: { projectId: string; categoryId: string }) =>
      dataSource.documents.removeCategory(projectId, categoryId),
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: documentKeys.categories(projectId) });
      qc.invalidateQueries({ queryKey: documentKeys.list(projectId) });
    },
  });
}
