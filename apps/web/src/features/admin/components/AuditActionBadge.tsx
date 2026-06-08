import React from 'react';
import { Badge } from '../../../components/ui/Badge';
import type { BadgeProps } from '../../../components/ui/Badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

interface AuditActionBadgeProps {
  action: string;
}

const ACTION_MAP: Record<string, { variant: BadgeVariant; label: string }> = {
  LOGIN:               { variant: 'info',    label: 'Login' },
  REGISTER:            { variant: 'success', label: 'Registro' },
  USER_ROLE_CHANGED:   { variant: 'warning', label: 'Cambio de rol' },
  USER_STATUS_CHANGED: { variant: 'warning', label: 'Cambio de status' },
  USER_DELETED:        { variant: 'error',   label: 'Eliminado' },
};

export function AuditActionBadge({ action }: AuditActionBadgeProps) {
  const config = ACTION_MAP[action] ?? { variant: 'neutral' as const, label: action };
  return <Badge variant={config.variant} dot>{config.label}</Badge>;
}
