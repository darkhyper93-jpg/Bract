import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { GeneratedAttempt } from '@bract/shared';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { queryKeys } from '../../../lib/queryKeys';
import { cn } from '../../../utils/cn';
import { QuizSetup } from './QuizSetup';
import { QuizRunner } from './QuizRunner';
import { QuizResults } from './QuizResults';
import { QuizHistory } from './QuizHistory';
import { QuizAttemptDetail } from './QuizAttemptDetail';
import type { AnsweredQuestion } from '../types';

type Tab = 'new' | 'history';
type Phase = 'setup' | 'running' | 'results';

// Evaluación / Quiz (Agente I). Orquesta el flujo "Nuevo quiz" (setup → runner → resultados) y el
// "Historial" (lista → detalle). El runner corrige por pregunta en el server (anti-trampa); al completar
// se invalida el historial para que el intento aparezca.
export default function QuizPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('new');

  // Flujo "Nuevo quiz".
  const [phase, setPhase] = useState<Phase>('setup');
  const [attempt, setAttempt] = useState<GeneratedAttempt | null>(null);
  const [answers, setAnswers] = useState<AnsweredQuestion[]>([]);

  // Flujo "Historial".
  const [detailId, setDetailId] = useState<string | null>(null);

  const startOver = () => {
    setAttempt(null);
    setAnswers([]);
    setPhase('setup');
  };

  const onGenerated = (a: GeneratedAttempt) => {
    setAttempt(a);
    setAnswers([]);
    setPhase('running');
  };

  const onFinished = (ans: AnsweredQuestion[]) => {
    setAnswers(ans);
    setPhase('results');
    // El intento quedó COMPLETED en el server → refrescar el historial.
    void queryClient.invalidateQueries({ queryKey: queryKeys.quiz.attempts() });
  };

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm transition-colors duration-[150ms]',
        tab === value
          ? 'border-brand-primary bg-brand-muted text-brand-primary'
          : 'border-border-default text-text-secondary hover:text-text-primary',
      )}
    >
      {label}
    </button>
  );

  return (
    <PageWrapper title={t('quiz.title')} description={t('quiz.description')}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('quiz.title')}>
          {tabButton('new', t('quiz.tabs.new'))}
          {tabButton('history', t('quiz.tabs.history'))}
        </div>

        {tab === 'new' ? (
          phase === 'setup' ? (
            <QuizSetup onGenerated={onGenerated} />
          ) : phase === 'running' && attempt ? (
            <QuizRunner attempt={attempt} onFinished={onFinished} onQuit={startOver} />
          ) : phase === 'results' && attempt ? (
            <QuizResults attempt={attempt} answers={answers} onRestart={startOver} />
          ) : null
        ) : detailId ? (
          <QuizAttemptDetail id={detailId} onBack={() => setDetailId(null)} />
        ) : (
          <QuizHistory onOpen={setDetailId} />
        )}
      </div>
    </PageWrapper>
  );
}
