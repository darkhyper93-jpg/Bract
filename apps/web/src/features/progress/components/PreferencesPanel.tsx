import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { RemediationIntensity } from '@bract/shared';
import { usePreferences, useUpdatePreferences } from '../hooks/usePreferences';
import { preferencesFormSchema, type PreferencesFormValues } from '../schemas/preferences.form.schema';
import { useSubjects } from '../../planner/hooks/useSubjects';
import { Skeleton } from '../../../components/ui/Skeleton';

const INTENSITIES: RemediationIntensity[] = [
  RemediationIntensity.OFF,
  RemediationIntensity.LOW,
  RemediationIntensity.MEDIUM,
  RemediationIntensity.HIGH,
];

const INTENSITY_LABEL_KEY: Record<RemediationIntensity, string> = {
  [RemediationIntensity.OFF]: 'progress.remediationOff',
  [RemediationIntensity.LOW]: 'progress.remediationLow',
  [RemediationIntensity.MEDIUM]: 'progress.remediationMedium',
  [RemediationIntensity.HIGH]: 'progress.remediationHigh',
};

export function PreferencesPanel() {
  const { t } = useTranslation();
  const prefs = usePreferences();
  // Fuente única del árbol de materias (reuso del planner). Devuelve { subjects, isLoading, isError }.
  const { subjects, isLoading: subjectsLoading, isError: subjectsError } = useSubjects();
  const update = useUpdatePreferences();

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesFormSchema),
    defaultValues: {
      remediationIntensity: RemediationIntensity.LOW,
      dailyGoalMinutes: null,
      prioritySubjectIds: [],
    },
  });

  useEffect(() => {
    if (prefs.data) {
      form.reset({
        remediationIntensity: prefs.data.remediationIntensity,
        dailyGoalMinutes: prefs.data.dailyGoalMinutes,
        prioritySubjectIds: prefs.data.prioritySubjectIds,
      });
    }
  }, [prefs.data, form]);

  if (prefs.isLoading) return <Skeleton className="h-40 w-full" />;

  const onSubmit = (values: PreferencesFormValues) => update.mutate(values);

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="rounded-xl border border-border-subtle bg-bg-surface p-4"
    >
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('progress.preferencesTitle')}</h3>

      <label className="mb-1 block text-xs text-text-secondary">{t('progress.remediationIntensity')}</label>
      <select
        {...form.register('remediationIntensity')}
        className="mb-4 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
      >
        {INTENSITIES.map((i) => (
          <option key={i} value={i}>
            {t(INTENSITY_LABEL_KEY[i])}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-xs text-text-secondary">{t('progress.dailyGoalMinutes')}</label>
      <input
        type="number"
        {...form.register('dailyGoalMinutes')}
        className="mb-4 w-full rounded-lg border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-primary"
      />

      {/* Multiselect de materias prioritarias — adelanta esas materias en el plan (nudge fijo, vale aun en OFF).
          Los 4 estados de la query de materias (loading · error · empty · success). */}
      <label className="mb-1 block text-xs text-text-secondary">{t('progress.prioritySubjects')}</label>
      <div className="mb-4">
        {subjectsLoading && <Skeleton className="h-20 w-full" />}
        {!subjectsLoading && subjectsError && (
          <p className="text-xs text-error">{t('progress.prioritySubjectsError')}</p>
        )}
        {!subjectsLoading && !subjectsError && subjects.length === 0 && (
          <p className="text-xs text-text-tertiary">{t('progress.prioritySubjectsEmpty')}</p>
        )}
        {!subjectsLoading && !subjectsError && subjects.length > 0 && (
          <ul className="space-y-1">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`prio-${s.id}`}
                  value={s.id}
                  {...form.register('prioritySubjectIds')}
                  className="h-4 w-4 rounded border-border-subtle bg-bg-elevated"
                />
                <label htmlFor={`prio-${s.id}`} className="truncate text-sm text-text-secondary">
                  {s.name}
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="submit"
        disabled={update.isPending}
        className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {update.isPending ? t('common.loading') : t('progress.save')}
      </button>
      {update.isSuccess && <p className="mt-2 text-xs text-success">{t('progress.saved')}</p>}
    </form>
  );
}
