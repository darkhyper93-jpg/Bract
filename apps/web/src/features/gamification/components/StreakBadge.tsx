import { useTranslation } from 'react-i18next';
import type { GamificationProfile } from '@bract/shared';
import { Tooltip } from '../../../components/ui/Tooltip';
import { FlameIcon, ShieldIcon } from './icons';

// Racha perdonadora: flama + contador + escudos. Framing amable cuando no hay racha (sin culpa). Los
// escudos cubren días perdidos (tooltip explica). Nunca cuesta XP ni nivel (mensaje de ayuda).
export function StreakBadge({ profile }: { profile: GamificationProfile }) {
  const { t } = useTranslation();
  const hasStreak = profile.currentStreak > 0;

  return (
    <div className="flex items-center justify-between gap-3">
      <Tooltip content={t('gamification.streakHint')} placement="top">
        <span className="flex items-center gap-2.5 cursor-default">
          <span
            className={
              hasStreak
                ? 'flex h-10 w-10 items-center justify-center rounded-full bg-game-flame/15 text-game-flame'
                : 'flex h-10 w-10 items-center justify-center rounded-full bg-bg-elevated text-text-tertiary'
            }
          >
            <FlameIcon className="h-5 w-5" />
          </span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary">
              {hasStreak
                ? t('gamification.streakDays', { count: profile.currentStreak })
                : t('gamification.streakNone')}
            </span>
            <span className="text-xs text-text-tertiary">{t('gamification.streakTitle')}</span>
          </span>
        </span>
      </Tooltip>

      {profile.freezeTokens > 0 && (
        <Tooltip content={t('gamification.shieldsHint')} placement="top">
          <span className="flex items-center gap-1.5 rounded-full bg-bg-elevated px-2.5 py-1 text-info cursor-default">
            <ShieldIcon className="h-4 w-4" />
            <span className="text-xs font-medium text-text-secondary">
              {t('gamification.shields', { count: profile.freezeTokens })}
            </span>
          </span>
        </Tooltip>
      )}
    </div>
  );
}
