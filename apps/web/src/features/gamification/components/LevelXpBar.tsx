import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import type { GamificationProfile } from '@bract/shared';
import { LevelIcon } from './icons';

// Nivel + barra de XP. La barra se anima con `scaleX` (transform, no width → sin reflow). Respeta
// prefers-reduced-motion (sin transición). El nivel se deriva en el server con la curva compartida.
export function LevelXpBar({ profile }: { profile: GamificationProfile }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const maxed = profile.xpForNextLevel <= 0;
  const pct = maxed ? 1 : Math.min(1, Math.max(0, profile.xpIntoLevel / profile.xpForNextLevel));
  const remaining = maxed ? 0 : profile.xpForNextLevel - profile.xpIntoLevel;

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-game-glow/15 text-game-glow">
        <LevelIcon className="h-6 w-6" />
        <span className="absolute -bottom-1 -right-1 rounded-full bg-bg-elevated px-1.5 text-xs font-semibold text-text-primary ring-1 ring-border-default">
          {profile.level}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-text-primary">
            {t('gamification.levelLabel', { level: profile.level })}
          </span>
          <span className="text-xs text-text-tertiary">
            {maxed
              ? t('gamification.xpMaxed')
              : t('gamification.xpToNext', { xp: remaining })}
          </span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated"
          role="progressbar"
          aria-valuenow={Math.round(pct * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="h-full origin-left rounded-full bg-game-xp"
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: pct }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
            style={{ width: '100%' }}
          />
        </div>
        <p className="mt-1 text-xs text-text-tertiary">
          {t('gamification.xpProgress', {
            into: profile.xpIntoLevel,
            total: maxed ? profile.xpIntoLevel : profile.xpForNextLevel,
          })}
        </p>
      </div>
    </div>
  );
}
