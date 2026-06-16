import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWeakTopics } from '../../progress/hooks/useProgress';
import { SectionCard } from './SectionCard';
import { Skeleton } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Button } from '../../../components/ui/Button';

// "En qué enfocarte" (reusa I-2): top 3 de puntos débiles — lo más accionable del Home (qué estudiar
// hoy). Variante COMPACTA inline (no reusa WeakTopicsList para no anidar card+título); el dashboard
// completo de débiles vive en /progress vía "ver más".
const TOP = 3;

export function FocusSection() {
  const { t } = useTranslation();
  const weak = useWeakTopics(TOP);

  const viewMore = (
    <Link to="/progress" className="text-xs font-medium text-brand-primary hover:underline">
      {t('home.focusViewMore')}
    </Link>
  );

  let body: ReactNode;
  if (weak.isLoading) {
    body = (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  } else if (weak.isError) {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm text-text-tertiary">{t('home.focusError')}</p>
        <Button variant="secondary" size="sm" onClick={() => void weak.refetch()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  } else if (!weak.data || weak.data.length === 0) {
    body = (
      <EmptyState
        title={t('home.focusEmptyTitle')}
        description={t('home.focusEmptyDescription')}
        className="py-8"
      />
    );
  } else {
    body = (
      <ol className="space-y-2">
        {weak.data.map((topic, i) => (
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
    );
  }

  return (
    <SectionCard title={t('home.focusTitle')} action={viewMore}>
      {body}
    </SectionCard>
  );
}
