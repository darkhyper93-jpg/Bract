import { useTranslation } from 'react-i18next';
import type { CalibrationSummary } from '@bract/shared';

// Calibración de confianza (Calidad de aprendizaje, fase 1). Cruza la confianza declarada al responder
// contra el acierto real: una barra de acierto por nivel + los dos avisos de metacognición
// (sobreconfianza / infraconfianza). El padre solo la monta cuando hay datos (hasData=true).
export function CalibrationCard({ calibration }: { calibration: CalibrationSummary }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-text-primary">{t('progress.calibration.title')}</h3>
        <p className="text-xs text-text-tertiary">{t('progress.calibration.description')}</p>
      </div>

      <ul className="mt-3 space-y-2">
        {calibration.buckets.map((bucket) => (
          <li key={bucket.confidence} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-text-secondary">
              {t(`progress.calibration.confidence.${bucket.confidence}`)}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              {bucket.accuracy !== null && (
                <div
                  className="h-full rounded-full bg-brand-primary"
                  style={{ width: `${Math.round(bucket.accuracy * 100)}%` }}
                />
              )}
            </div>
            <span className="w-28 shrink-0 text-right text-xs text-text-tertiary">
              {bucket.accuracy !== null
                ? t('progress.calibration.accuracyLabel', { pct: Math.round(bucket.accuracy * 100) })
                : '—'}
            </span>
          </li>
        ))}
      </ul>

      {(calibration.overconfidentCount > 0 || calibration.underconfidentCount > 0) && (
        <div className="mt-3 space-y-1 border-t border-border-subtle pt-3">
          {calibration.overconfidentCount > 0 && (
            <p className="text-xs text-error">
              {t('progress.calibration.overconfident', { count: calibration.overconfidentCount })}
            </p>
          )}
          {calibration.underconfidentCount > 0 && (
            <p className="text-xs text-text-tertiary">
              {t('progress.calibration.underconfident', { count: calibration.underconfidentCount })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
