import { useTranslation } from 'react-i18next';
import { StudyPlanItemStatus, type StudyPlanItemWithTopic } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { cn } from '../../../utils/cn';
import { useToast } from '../../../hooks/useToast';
import { usePlan } from '../hooks/usePlan';
import { usePlanMutations } from '../hooks/usePlanMutations';
import { groupPlanByDay, formatDayLabel, formatMinutes } from '../utils/plan.utils';
import { DifficultyBadge } from './badges';

function IconCalendar() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

interface PlanItemRowProps {
  item: StudyPlanItemWithTopic;
}

function PlanItemRow({ item }: PlanItemRowProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { updateItem } = usePlanMutations();

  const isPendingThis = updateItem.isPending && updateItem.variables?.id === item.id;
  const isDone = item.status === StudyPlanItemStatus.COMPLETED;
  const isSkipped = item.status === StudyPlanItemStatus.SKIPPED;

  const setStatus = (status: StudyPlanItemStatus) => {
    updateItem.mutate({ id: item.id, status }, { onError: () => toast.error(t('planner.toast.error')) });
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2.5',
        (isDone || isSkipped) && 'opacity-60',
      )}
    >
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm text-text-primary',
            isDone && 'line-through',
            isSkipped && 'line-through text-text-tertiary',
          )}
        >
          {item.topic.name}
        </p>
        <p className="mt-0.5 text-xs text-text-tertiary">
          {t('planner.plan.minutesEstimate', { time: formatMinutes(item.estimatedMinutes) })}
        </p>
      </div>

      <DifficultyBadge difficulty={item.topic.difficulty} />

      {isDone ? (
        <Badge variant="success">{t('planner.plan.done')}</Badge>
      ) : isSkipped ? (
        <Badge variant="neutral">{t('planner.plan.skipped')}</Badge>
      ) : (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            disabled={isPendingThis}
            onClick={() => setStatus(StudyPlanItemStatus.SKIPPED)}
          >
            {t('planner.plan.skip')}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={isPendingThis}
            onClick={() => setStatus(StudyPlanItemStatus.COMPLETED)}
          >
            {t('planner.plan.markDone')}
          </Button>
        </div>
      )}
    </div>
  );
}

interface PlanViewProps {
  onGenerate: () => void;
  isGenerating: boolean;
}

export function PlanView({ onGenerate, isGenerating }: PlanViewProps) {
  const { t, i18n } = useTranslation();
  const { plan, isLoading, isError, refetch } = usePlan();
  const days = groupPlanByDay(plan);

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4 sm:p-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">{t('planner.plan.title')}</h2>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : isError ? (
        <ErrorState
          title={t('planner.errorLoad')}
          message={t('common.error')}
          onRetry={() => refetch()}
        />
      ) : days.length === 0 ? (
        <EmptyState
          icon={<IconCalendar />}
          title={t('planner.plan.empty')}
          description={t('planner.plan.emptyDescription')}
          action={
            <Button onClick={onGenerate} loading={isGenerating}>
              {t('planner.generate')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-5">
          {days.map((day) => (
            <div key={day.date}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium capitalize text-text-primary">
                  {formatDayLabel(day.date, i18n.language)}
                </h3>
                <span className="text-xs text-text-tertiary">
                  {t('planner.plan.dayTotal', { time: formatMinutes(day.totalMinutes) })}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {day.items.map((item) => (
                  <PlanItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
