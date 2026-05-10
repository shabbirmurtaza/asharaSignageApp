import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/api';

export interface NotificationRow {
  id: string;
  user_id: string;
  usage_id?: string | null;
  type: string;
  title: string;
  body?: string | null;
  read_at?: string | null;
  created_at: string;
}

const POLL_MS = 30_000;

export const listMyNotifications = (
  userId: string,
): Promise<NotificationRow[]> =>
  db.from<NotificationRow>('notifications').select('*', {
    user_id: `eq.${userId}`,
    read_at: 'is.null',
    order: 'created_at.desc',
    limit: '20',
  });

export const markNotificationRead = (id: string): Promise<NotificationRow> =>
  db
    .from<NotificationRow>('notifications')
    .update(
      { read_at: new Date().toISOString() },
      { id: `eq.${id}` },
    )
    .then((rows) => {
      if (!rows[0]) throw new Error('Notification not found');
      return rows[0];
    });

const KEY = (userId: string) => ['notifications', userId] as const;

export const useNotifications = (userId: string | undefined) =>
  useQuery({
    queryKey: KEY(userId ?? ''),
    queryFn: () => listMyNotifications(userId as string),
    enabled: !!userId,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

export const useMarkNotificationRead = (userId: string | undefined) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: KEY(userId) });
    },
  });
};
