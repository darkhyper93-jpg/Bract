import i18n from '../lib/i18n';

export function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const locale = i18n.language.startsWith('es') ? 'es-ES' : 'en-US';
  if (diff < 60_000) return i18n.t('common.time.justNow');
  if (diff < 3_600_000) return i18n.t('common.time.minutesAgo', { count: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return i18n.t('common.time.hoursAgo', { count: Math.floor(diff / 3_600_000) });
  if (diff < 172_800_000) return i18n.t('common.time.yesterday');
  return new Date(dateString).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
