import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { SetAvailabilityInput } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useToast } from '../../../hooks/useToast';
import { useAvailability } from '../hooks/useAvailability';
import { usePlanMutations } from '../hooks/usePlanMutations';
import { availabilityFormSchema, type AvailabilityFormValues } from '../schemas/planner.form.schema';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function AvailabilityPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const { availability, isLoading, isError, refetch } = useAvailability();
  const { saveAvailability } = usePlanMutations();

  // minutos (backend) → horas (UI), 7 posiciones indexadas por weekday.
  const initialHours = React.useMemo(() => {
    const hours = Array<number>(7).fill(0);
    for (const day of availability) {
      hours[day.weekday] = Math.round((day.minutes / 60) * 100) / 100;
    }
    return hours;
  }, [availability]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilityFormSchema),
    defaultValues: { hours: initialHours },
  });

  React.useEffect(() => {
    reset({ hours: initialHours });
  }, [initialHours, reset]);

  const watchedHours = watch('hours');
  const totalHours = Array.isArray(watchedHours)
    ? watchedHours.reduce((acc, h) => acc + (Number.isFinite(h) ? h : 0), 0)
    : 0;

  const onSubmit = (values: AvailabilityFormValues) => {
    const input: SetAvailabilityInput = {
      days: values.hours
        .map((h, weekday) => ({ weekday, minutes: Math.round(h * 60) }))
        .filter((d) => d.minutes > 0),
    };
    saveAvailability.mutate(input, {
      onSuccess: () => toast.success(t('planner.toast.availabilitySaved')),
      onError: () => toast.error(t('planner.toast.error')),
    });
  };

  return (
    <section className="rounded-xl border border-border-subtle bg-bg-surface/40 p-4 sm:p-5">
      <header className="mb-1 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-primary">{t('planner.availability.title')}</h2>
        <span className="text-xs text-text-tertiary">
          {t('planner.availability.totalWeek', { hours: Math.round(totalHours * 10) / 10 })}
        </span>
      </header>
      <p className="mb-4 text-sm text-text-secondary">{t('planner.availability.description')}</p>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <ErrorState
          title={t('planner.errorLoad')}
          message={t('common.error')}
          onRetry={() => refetch()}
        />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {WEEKDAYS.map((weekday) => (
              <div
                key={weekday}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-surface px-3 py-2"
              >
                <label htmlFor={`hours-${weekday}`} className="text-sm text-text-secondary">
                  {t(`planner.weekdays.${weekday}`)}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`hours-${weekday}`}
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    className="h-8 w-20 rounded-lg border border-border-default bg-bg-surface px-2 text-right text-sm text-text-primary transition-colors duration-[150ms] focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
                    {...register(`hours.${weekday}` as const, { valueAsNumber: true })}
                  />
                  <span className="w-9 text-xs text-text-tertiary">{t('planner.availability.hours')}</span>
                </div>
              </div>
            ))}
          </div>
          {errors.hours && (
            <p className="text-xs text-error">{t('planner.availability.hoursRange')}</p>
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={saveAvailability.isPending}>
              {t('planner.availability.save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
