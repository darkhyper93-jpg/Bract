import React from 'react';
import { useTranslation } from 'react-i18next';
import { UserPublic, UserStatus } from '@bract/shared';
import { Avatar } from '../../../components/ui/Avatar';
import { Badge } from '../../../components/ui/Badge';

type BadgeVariant = 'success' | 'warning' | 'neutral' | 'error' | 'info';

const statusVariant: Record<UserStatus, BadgeVariant> = {
  [UserStatus.ACTIVE]: 'success',
  [UserStatus.SUSPENDED]: 'warning',
  [UserStatus.DELETED]: 'neutral',
};

interface UserDetailCardProps {
  user: UserPublic;
}

interface FieldProps {
  label: string;
  value: React.ReactNode;
}

function Field({ label, value }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">{label}</p>
      <div className="text-sm text-text-primary">{value}</div>
    </div>
  );
}

export function UserDetailCard({ user }: UserDetailCardProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith('es') ? 'es-ES' : 'en-US';
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
      <div className="flex items-start gap-4">
        <Avatar src={user.avatarUrl} name={user.name} size="xl" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-text-primary">{user.name}</h2>
          <p className="text-sm text-text-secondary">{user.email}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="info">{t(`users.roles.${user.role}`)}</Badge>
            <Badge variant={statusVariant[user.status]} dot>
              {t(`users.statuses.${user.status}`)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border-subtle pt-6 sm:grid-cols-2">
        <Field label={t('users.detail.userId')} value={<code className="text-xs text-text-secondary">{user.id}</code>} />
        <Field
          label={t('users.detail.memberSince')}
          value={new Date(user.createdAt).toLocaleDateString(dateLocale, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        />
        <Field label={t('users.detail.email')} value={user.email} />
      </div>
    </div>
  );
}
