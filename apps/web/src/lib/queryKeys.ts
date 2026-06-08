export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },

  users: {
    all: () => ['users'] as const,
    list: (filters?: Record<string, unknown>) =>
      ['users', 'list', filters] as const,
    detail: (id: string) => ['users', id] as const,
  },

  notifications: {
    all: () => ['notifications'] as const,
    list: (params?: Record<string, unknown>) =>
      ['notifications', 'list', params] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
    detail: (id: string) => ['notifications', id] as const,
  },

  analytics: {
    all: () => ['analytics'] as const,
    overview: () => ['analytics', 'overview'] as const,
    users: (filters?: Record<string, unknown>) =>
      ['analytics', 'users', filters] as const,
    activity: (filters?: Record<string, unknown>) =>
      ['analytics', 'activity', filters] as const,
  },

  files: {
    all: () => ['files'] as const,
    detail: (id: string) => ['files', id] as const,
  },

  admin: {
    all:       () => ['admin'] as const,
    stats:     () => ['admin', 'stats'] as const,
    auditLogs: (params?: object) => ['admin', 'audit-logs', params] as const,
  },
} as const;
