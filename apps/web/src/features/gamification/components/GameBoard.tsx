import { useTranslation } from 'react-i18next';
import { useGamificationSummary } from '../hooks/useGamificationSummary';
import { LevelXpBar } from './LevelXpBar';
import { StreakBadge } from './StreakBadge';
import { DailyMissions } from './DailyMissions';
import { BossOfDay } from './BossOfDay';
import { CelebrationOverlay, useGamificationCelebration } from './CelebrationOverlay';
import { Skeleton } from '../../../components/ui/Skeleton';
import { Button } from '../../../components/ui/Button';

// Tablero de juego de la Home (Agente J, §8.11): nivel + XP + racha, misiones del día y jefe del día.
// SOLO lectura (el XP se gana por efecto de estudiar, no acá). Maneja sus 4 estados y degrada solo: si
// el summary falla, el resto de la Home (plan/progreso/materias) sigue funcionando. Los momentos
// animados se disparan al diffear el summary tras una acción (CelebrationOverlay).
export function GameBoard() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useGamificationSummary();
  const { current, dismiss } = useGamificationCelebration(data);

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-surface p-5">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-10 w-2/3" />
        </div>
        <div className="space-y-4 rounded-xl border border-border-subtle bg-bg-surface p-5">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-surface p-5">
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-text-tertiary">{t('gamification.error')}</p>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-5 rounded-xl border border-border-subtle bg-bg-surface p-5">
          <LevelXpBar profile={data.profile} />
          <div className="h-px bg-border-subtle" />
          <StreakBadge profile={data.profile} />
        </section>
        <DailyMissions quests={data.quests} />
      </div>
      <BossOfDay boss={data.boss} />
      <CelebrationOverlay celebration={current} onDismiss={dismiss} />
    </>
  );
}
