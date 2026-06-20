import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BossStatus } from '@bract/shared';
import type { GamificationSummary } from '@bract/shared';
import { LevelIcon, BossIcon } from './icons';

// Momento animado (clase primaria): subir de nivel / vencer al jefe. Se dispara al DIFFEAR el summary
// (previo vs nuevo) tras una acción de estudio — los endpoints de acción no cambian su contrato.

type Celebration =
  | { kind: 'levelUp'; level: number }
  | { kind: 'bossDefeated'; xp: number };

const AUTO_DISMISS_MS = 2800;

// Compara el summary previo con el nuevo y encola los momentos a celebrar. El PRIMER dato no celebra
// (solo siembra la referencia, si no festejaría al abrir la Home). `dismiss` avanza la cola.
export function useGamificationCelebration(summary: GamificationSummary | undefined): {
  current: Celebration | null;
  dismiss: () => void;
} {
  const prev = useRef<GamificationSummary | undefined>(undefined);
  const [queue, setQueue] = useState<Celebration[]>([]);

  useEffect(() => {
    if (!summary) return;
    const before = prev.current;
    prev.current = summary;
    if (!before) return; // primer dato: sembrar sin celebrar

    const events: Celebration[] = [];
    if (summary.profile.level > before.profile.level) {
      events.push({ kind: 'levelUp', level: summary.profile.level });
    }
    const wasActive = before.boss?.status === BossStatus.ACTIVE;
    const nowBoss = summary.boss;
    if (wasActive && nowBoss && nowBoss.status === BossStatus.DEFEATED) {
      events.push({ kind: 'bossDefeated', xp: nowBoss.xpReward });
    }
    if (events.length > 0) setQueue((q) => [...q, ...events]);
  }, [summary]);

  return {
    current: queue[0] ?? null,
    dismiss: () => setQueue((q) => q.slice(1)),
  };
}

export function CelebrationOverlay({
  celebration,
  onDismiss,
}: {
  celebration: Celebration | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!celebration) return;
    const id = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [celebration, onDismiss]);

  const isLevel = celebration?.kind === 'levelUp';
  const title = celebration
    ? isLevel
      ? t('gamification.celebrate.levelUp')
      : t('gamification.celebrate.bossDefeated')
    : '';
  const subtitle = celebration
    ? isLevel
      ? t('gamification.celebrate.levelUpLevel', { level: celebration.level })
      : t('gamification.celebrate.xpReward', { xp: celebration.xp })
    : '';

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/60 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          onClick={onDismiss}
          role="dialog"
          aria-live="polite"
          aria-label={title}
        >
          <motion.div
            className="flex flex-col items-center gap-3 rounded-2xl border border-border-default bg-bg-elevated px-8 py-7 text-center shadow-2xl shadow-black/50"
            initial={reduce ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={
                isLevel
                  ? 'flex h-16 w-16 items-center justify-center rounded-full bg-game-glow/15 text-game-glow'
                  : 'flex h-16 w-16 items-center justify-center rounded-full bg-game-xp/15 text-game-xp'
              }
            >
              {isLevel ? <LevelIcon className="h-8 w-8" /> : <BossIcon className="h-8 w-8" />}
            </span>
            <p className="text-lg font-semibold text-text-primary">{title}</p>
            <p className={isLevel ? 'text-sm text-game-glow' : 'text-sm text-game-xp'}>{subtitle}</p>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-1 rounded-lg bg-bg-overlay px-4 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
            >
              {t('gamification.celebrate.dismiss')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
