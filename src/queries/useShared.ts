import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSource } from '@/data/client/index';
import type { Preferences } from '@/types';
import type { CreateUserInput, NewMessage } from '@/data/client/dataSource';

// ---- Notifications ----
export const notificationKeys = { all: ['notifications'] as const };

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => dataSource.notifications.list(),
    refetchInterval: 5000, // poll every 5s for real-time feel
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dataSource.notifications.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

// ---- Tenant notifications ----
export const tenantNotifKeys = {
  forTenant: (email: string) => ['notifications', 'tenant', email] as const,
};

export function useTenantNotifications(tenantEmail: string) {
  return useQuery({
    queryKey: tenantNotifKeys.forTenant(tenantEmail),
    queryFn: () => dataSource.notifications.listForTenant(tenantEmail),
    enabled: !!tenantEmail,
    refetchInterval: 5000,
  });
}

export function useMarkTenantNotificationsRead(tenantEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dataSource.notifications.markAllReadForTenant(tenantEmail),
    onSuccess: () => qc.invalidateQueries({ queryKey: tenantNotifKeys.forTenant(tenantEmail) }),
  });
}

// ---- Messages ----
export const messageKeys = {
  thread: (threadId: string) => ['messages', threadId] as const,
  threads: ['messages', 'all-threads'] as const,
};

export function useMessages(threadId: string) {
  return useQuery({
    queryKey: messageKeys.thread(threadId),
    queryFn: () => dataSource.messages.list(threadId),
    enabled: !!threadId,
    refetchInterval: 5000, // poll every 5s so both sides see new messages
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ threadId, msg }: { threadId: string; msg: NewMessage }) =>
      dataSource.messages.send(threadId, msg),
    onSuccess: (_data, { threadId }) => {
      qc.invalidateQueries({ queryKey: messageKeys.thread(threadId) });
      qc.invalidateQueries({ queryKey: messageKeys.threads });
    },
  });
}

export function useMessageThreads() {
  return useQuery({
    queryKey: messageKeys.threads,
    queryFn: () => dataSource.messages.listThreads(),
    refetchInterval: 5000,
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (threadId: string) => dataSource.messages.markThreadRead(threadId),
    onSuccess: (_data, threadId) => {
      qc.invalidateQueries({ queryKey: messageKeys.thread(threadId) });
      qc.invalidateQueries({ queryKey: messageKeys.threads });
    },
  });
}

// ---- Preferences ----
export const preferenceKeys = { all: ['preferences'] as const };

export function usePreferences() {
  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: () => dataSource.preferences.get(),
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<Preferences>) => dataSource.preferences.update(changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: preferenceKeys.all }),
  });
}

// ---- Technicians ----
export const technicianKeys = { all: ['technicians'] as const };

export function useTechnicians() {
  return useQuery({
    queryKey: technicianKeys.all,
    queryFn: () => dataSource.technicians.list(),
  });
}

// ---- Users ----
export const userKeys = { all: ['users'] as const };

export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: () => dataSource.users.list(),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => dataSource.users.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: userKeys.all }),
  });
}
