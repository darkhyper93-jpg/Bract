import { useTranslation } from 'react-i18next';
import type { SubjectProgress } from '@bract/shared';
import { cn } from '../../../utils/cn';

// Tarjeta por materia: barra de acierto por tema + chip de debilidad. Sin datos ⇒ tema en estado tenue.
export function SubjectProgressCard({ subject }: { subject: SubjectProgress }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">{subject.name}</h3>
        {subject.accuracy !== null && (
          <span className="text-xs text-text-tertiary">
            {t('progress.accuracy')}: {Math.round(subject.accuracy * 100)}%
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {subject.topics.map((topic) => (
          <li key={topic.topicId} className="flex items-center gap-3">
            <span
              className={cn(
                'w-40 shrink-0 truncate text-xs',
                topic.hasData ? 'text-text-secondary' : 'text-text-tertiary',
              )}
            >
              {topic.name}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-elevated">
              {topic.hasData && topic.accuracy !== null && (
                <div
                  className="h-full rounded-full bg-brand-primary"
                  style={{ width: `${Math.round(topic.accuracy * 100)}%` }}
                />
              )}
            </div>
            <span className="w-16 shrink-0 text-right text-xs text-text-tertiary">
              {topic.hasData ? `${Math.round(topic.weakness * 100)}% ${t('progress.weakShort')}` : '—'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
