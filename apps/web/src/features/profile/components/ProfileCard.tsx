import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../components/ui/Badge';
import { useProfile } from '../hooks/useProfile';
import { AvatarUploader } from './AvatarUploader';
import { Role, UserStatus } from '@bract/shared';

function roleVariant(role: Role): 'info' | 'warning' | 'error' | 'neutral' {
  if (role === Role.SUPER_ADMIN) return 'error';
  if (role === Role.ADMIN) return 'warning';
  return 'neutral';
}

function statusVariant(status: UserStatus): 'success' | 'error' | 'neutral' {
  if (status === UserStatus.ACTIVE) return 'success';
  if (status === UserStatus.SUSPENDED) return 'error';
  return 'neutral';
}

function formatDate(date: Date | string, locale: string): string {
  return new Date(date).toLocaleDateString(locale.startsWith('es') ? 'es-ES' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function ProfileCard() {
  const { t, i18n } = useTranslation();
  const { profile } = useProfile();

  if (!profile) return null;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-6 flex flex-col items-center gap-4">
      <AvatarUploader />
      <div className="text-center">
        <p className="text-base font-semibold text-text-primary">{profile.name}</p>
        <p className="text-sm text-text-secondary mt-0.5">{profile.email}</p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <Badge variant={roleVariant(profile.role)}>{profile.role}</Badge>
        <Badge variant={statusVariant(profile.status)} dot>
          {profile.status}
        </Badge>
      </div>
      <p className="text-xs text-text-tertiary">
        {t('profile.memberSince', { date: formatDate(profile.createdAt, i18n.language) })}
      </p>
    </div>
  );
}
