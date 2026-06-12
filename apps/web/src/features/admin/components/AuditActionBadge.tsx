import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge';
import type { BadgeProps } from '../../../components/ui/Badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

interface AuditActionBadgeProps {
  action: string;
}

const ACTION_VARIANT: Record<string, BadgeVariant> = {
  LOGIN:               'info',
  REGISTER:            'success',
  USER_ROLE_CHANGED:   'warning',
  USER_STATUS_CHANGED: 'warning',
  USER_DELETED:        'error',
};

export function AuditActionBadge({ action }: AuditActionBadgeProps) {
  const { t } = useTranslation();
  const variant = ACTION_VARIANT[action] ?? 'neutral';
  // Si la acción no tiene clave de traducción, se muestra el código crudo como fallback
  const label = t(`admin.actions.${action}`, { defaultValue: action });
  return <Badge variant={variant} dot>{label}</Badge>;
}
