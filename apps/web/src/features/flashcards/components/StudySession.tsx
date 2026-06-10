import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import type { FlashcardWithTopic, ReviewQuality } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useToast } from '../../../hooks/useToast';
import { useDueFlashcards } from '../hooks/useDueFlashcards';
import { useFlashcardMutations } from '../hooks/useFlashcardMutations';

function IconCheck() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// Botones de calidad SM-2 (Apéndice B): Again=0, Hard=3, Good=4, Easy=5.
const GRADES: { quality: ReviewQuality; labelKey: string; variant: 'danger' | 'ghost' | 'secondary' | 'primary' }[] = [
  { quality: 0, labelKey: 'flashcards.grade.again', variant: 'danger' },
  { quality: 3, labelKey: 'flashcards.grade.hard', variant: 'ghost' },
  { quality: 4, labelKey: 'flashcards.grade.good', variant: 'secondary' },
  { quality: 5, labelKey: 'flashcards.grade.easy', variant: 'primary' },
];

export function StudySession() {
  const { t } = useTranslation();
  const toast = useToast();
  const { flashcards, isLoading, isError, refetch } = useDueFlashcards();
  const { review } = useFlashcardMutations();

  // Snapshot local de la cola: calificar manda la carta al futuro y la sacaría de `due`, así que
  // congelamos la lista al iniciar y avanzamos por índice. "Nueva sesión" re-snapshotea.
  const [queue, setQueue] = useState<FlashcardWithTopic[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (queue === null && !isLoading && !isError && flashcards.length > 0) {
      setQueue(flashcards);
      setIdx(0);
      setRevealed(false);
    }
  }, [queue, isLoading, isError, flashcards]);

  const restart = () => {
    setQueue(null);
    setIdx(0);
    setRevealed(false);
    void refetch();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState title={t('flashcards.errorLoad')} message={t('common.error')} onRetry={() => refetch()} />
    );
  }

  // Sin cartas due (al entrar) o sesión recién reiniciada y ya no queda nada.
  if (queue === null) {
    return (
      <EmptyState
        icon={<IconCheck />}
        title={t('flashcards.study.allDone')}
        description={t('flashcards.study.allDoneDescription')}
      />
    );
  }

  // Sesión terminada: recorrimos toda la cola.
  if (idx >= queue.length) {
    return (
      <EmptyState
        icon={<IconCheck />}
        title={t('flashcards.study.sessionDone')}
        description={t('flashcards.study.sessionDoneCount', { count: queue.length })}
        action={<Button onClick={restart}>{t('flashcards.study.studyAgain')}</Button>}
      />
    );
  }

  const card = queue[idx];
  if (!card) return null;

  const grade = (quality: ReviewQuality) => {
    review.mutate(
      { id: card.id, quality },
      {
        onError: () => toast.error(t('flashcards.toast.error')),
      },
    );
    // Avance optimista: la persistencia ocurre en background; no bloqueamos el flujo de estudio.
    setIdx((i) => i + 1);
    setRevealed(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text-primary">{card.topic.name}</p>
          <p className="truncate text-xs text-text-tertiary">{card.topic.subjectName}</p>
        </div>
        <Badge variant="info">
          {t('flashcards.study.progress', { current: idx + 1, total: queue.length })}
        </Badge>
      </div>

      <div className="relative min-h-[16rem] rounded-2xl border border-border-subtle bg-bg-surface p-6 sm:p-8">
        <span className="text-xs uppercase tracking-wide text-text-tertiary">
          {t('flashcards.study.question')}
        </span>
        <p className="mt-2 text-lg text-text-primary">{card.question}</p>

        <AnimatePresence initial={false}>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="mt-5 border-t border-border-subtle pt-4"
            >
              <span className="text-xs uppercase tracking-wide text-text-tertiary">
                {t('flashcards.study.answer')}
              </span>
              <p className="mt-2 whitespace-pre-wrap text-base text-text-secondary">{card.answer}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g) => (
            <Button key={g.quality} variant={g.variant} onClick={() => grade(g.quality)}>
              {t(g.labelKey)}
            </Button>
          ))}
        </div>
      ) : (
        <Button onClick={() => setRevealed(true)}>{t('flashcards.study.reveal')}</Button>
      )}
    </div>
  );
}
