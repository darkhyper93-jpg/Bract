import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { cn } from '../../../utils/cn';
import { StudySession } from './StudySession';
import { TopicFlashcards } from './TopicFlashcards';

type Tab = 'study' | 'manage';

export default function FlashcardsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('study');

  const tabs: { id: Tab; labelKey: string }[] = [
    { id: 'study', labelKey: 'flashcards.tabs.study' },
    { id: 'manage', labelKey: 'flashcards.tabs.manage' },
  ];

  return (
    <PageWrapper title={t('flashcards.title')} description={t('flashcards.description')}>
      <div
        className="inline-flex gap-1 rounded-lg border border-border-subtle bg-bg-surface/60 p-1"
        role="tablist"
        aria-label={t('flashcards.title')}
      >
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors duration-[150ms]',
              tab === tb.id
                ? 'bg-bg-elevated text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div className="mt-5 max-w-2xl">{tab === 'study' ? <StudySession /> : <TopicFlashcards />}</div>
    </PageWrapper>
  );
}
