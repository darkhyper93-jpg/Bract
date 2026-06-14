import { useTranslation } from 'react-i18next';
import type { WeakTopic } from '@bract/shared';

// Lista ordenada de puntos débiles (ya viene ordenada desc del backend).
export function WeakTopicsList({ topics }: { topics: WeakTopic[] }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{t('progress.weakTitle')}</h3>
      <ol className="space-y-2">
        {topics.map((topic, i) => (
          <li key={topic.topicId} className="flex items-center gap-3 text-sm">
            <span className="w-5 shrink-0 text-text-tertiary">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-text-primary">{topic.name}</p>
              <p className="truncate text-xs text-text-tertiary">{topic.subjectName}</p>
            </div>
            <span className="shrink-0 rounded-full bg-error/10 px-2 py-0.5 text-xs font-medium text-error">
              {Math.round(topic.weakness * 100)}%
              {topic.lowConfidence ? ` · ${t('progress.lowConfidence')}` : ''}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
