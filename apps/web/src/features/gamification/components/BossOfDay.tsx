import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BossStatus } from '@bract/shared';
import type { DailyBoss } from '@bract/shared';
import { SectionCard } from '../../home/components/SectionCard';
import { EmptyState } from '../../../components/ui/EmptyState';
import { BossIcon, CheckIcon } from './icons';

// Jefe del día = el tema más flojo (I-2). Su "vida" se vacía con interacciones de dominio (aciertos /
// repasos buenos sobre el tema). Sin datos de debilidad ⇒ no hay jefe (EmptyState amable). El CTA lleva
// a /quiz (v1: el contrato del jefe no trae subjectId, así que no preseleccionamos — el daño igual se
// aplica al estudiar ese tema).
export function BossOfDay({ boss }: { boss: DailyBoss | null }) {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  if (!boss) {
    return (
      <SectionCard title={t('gamification.bossTitle')}>
        <EmptyState
          icon={<BossIcon className="h-6 w-6" />}
          title={t('gamification.bossEmptyTitle')}
          description={t('gamification.bossEmptyDescription')}
          className="py-8"
        />
      </SectionCard>
    );
  }

  const defeated = boss.status === BossStatus.DEFEATED;
  const pct = Math.min(1, Math.max(0, boss.maxHp > 0 ? boss.hp / boss.maxHp : 0));

  return (
    <SectionCard title={t('gamification.bossTitle')}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            className={
              defeated
                ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-game-xp/15 text-game-xp'
                : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-game-boss/15 text-game-boss'
            }
          >
            {defeated ? <CheckIcon className="h-6 w-6" /> : <BossIcon className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text-primary">{boss.topicName}</p>
            <p className="truncate text-xs text-text-tertiary">{boss.subjectName}</p>
          </div>
          {defeated && (
            <span className="rounded-full bg-game-xp/15 px-2.5 py-1 text-xs font-medium text-game-xp">
              {t('gamification.bossDefeated')}
            </span>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs text-text-tertiary">{t('gamification.bossHint')}</span>
            <span className="text-xs font-medium text-text-secondary">
              {t('gamification.bossHp', { hp: boss.hp, max: boss.maxHp })}
            </span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-bg-elevated"
            role="progressbar"
            aria-valuenow={boss.hp}
            aria-valuemin={0}
            aria-valuemax={boss.maxHp}
          >
            <motion.div
              className={defeated ? 'h-full origin-left rounded-full bg-game-xp' : 'h-full origin-left rounded-full bg-game-boss'}
              initial={false}
              animate={{ scaleX: pct }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 24 }}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {!defeated && (
          <div className="flex justify-end">
            <Link
              to="/quiz"
              className="inline-flex items-center gap-2 rounded-lg bg-game-boss/15 px-3.5 py-2 text-sm font-medium text-game-boss transition-colors hover:bg-game-boss/25 cursor-pointer"
            >
              <BossIcon className="h-4 w-4" />
              {t('gamification.bossCta')}
            </Link>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
