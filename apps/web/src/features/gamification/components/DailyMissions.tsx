import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { QuestStatus } from '@bract/shared';
import type { DailyQuest } from '@bract/shared';
import { SectionCard } from '../../home/components/SectionCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { CheckIcon, TargetIcon } from './icons';

function MissionRow({ quest }: { quest: DailyQuest }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const done = quest.status === QuestStatus.COMPLETED;
  const pct = Math.min(1, Math.max(0, quest.progress / quest.target));
  const label = t(`gamification.missionType.${quest.type}`, { target: quest.target });

  return (
    <li className="flex items-center gap-3">
      <span
        className={
          done
            ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-game-xp/15 text-game-xp'
            : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-elevated text-text-tertiary'
        }
      >
        {done ? <CheckIcon className="h-4 w-4" /> : <TargetIcon className="h-4 w-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={
              done
                ? 'truncate text-sm text-text-tertiary line-through'
                : 'truncate text-sm text-text-primary'
            }
          >
            {label}
          </span>
          <span className={done ? 'text-xs font-medium text-game-xp' : 'text-xs text-text-tertiary'}>
            {done
              ? t('gamification.missionXp', { xp: quest.xpReward })
              : t('gamification.missionProgress', { progress: quest.progress, target: quest.target })}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-elevated">
          <motion.div
            className={done ? 'h-full origin-left rounded-full bg-game-xp' : 'h-full origin-left rounded-full bg-brand-primary'}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: pct }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22 }}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </li>
  );
}

// Misiones diarias (3 fijas). Cada fila muestra su progreso; al completarse se tacha + check dorado +
// "+X XP". El momento animado fuerte (overlay) lo maneja el GameBoard al diffear el summary.
export function DailyMissions({ quests }: { quests: DailyQuest[] }) {
  const { t } = useTranslation();

  return (
    <SectionCard title={t('gamification.missionsTitle')}>
      {quests.length === 0 ? (
        <EmptyState title={t('gamification.missionEmpty')} className="py-6" />
      ) : (
        <ul className="space-y-4">
          {quests.map((q) => (
            <MissionRow key={q.type} quest={q} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
