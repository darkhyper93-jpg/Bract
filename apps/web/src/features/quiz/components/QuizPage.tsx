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
import type { QuizRunResult } from '../types';

type Tab = 'new' | 'history';
type Phase = 'setup' | 'running' | 'results';

// Intento EN PROGRESO persistido: sobrevive al cambio de tab (estado en QuizPage) y a un reload
// (localStorage). Se limpia al completar o abandonar. Es la app real → localStorage va bien acá.
const ACTIVE_ATTEMPT_KEY = 'bract.quiz.activeAttemptId';

function readActiveAttempt(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ATTEMPT_KEY);
  } catch {
    return null; // localStorage no disponible (modo privado / SSR) → degradar sin romper
  }
}

function writeActiveAttempt(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_ATTEMPT_KEY, id);
    else localStorage.removeItem(ACTIVE_ATTEMPT_KEY);
  } catch {
    // localStorage no disponible → el intento sigue vivo en memoria mientras no se recargue
  }
}

// Evaluación / Quiz (Agente I). Orquesta el flujo "Nuevo quiz" (setup → runner → resultados) y el
// "Historial" (lista → detalle). El runner se hidrata desde el server por attemptId, así ir a Historial
// y volver retoma donde estabas. El intento en progreso se persiste en localStorage para sobrevivir un
// reload, y se limpia al completar.
export default function QuizPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<Tab>('new');

  // Flujo "Nuevo quiz". El attemptId hidrata el runner desde el server (fuente de verdad).
  const [attemptId, setAttemptId] = useState<string | null>(() => readActiveAttempt());
  const [phase, setPhase] = useState<Phase>(() => (readActiveAttempt() ? 'running' : 'setup'));
  const [result, setResult] = useState<QuizRunResult | null>(null);
  // ¿el intento actual viene de localStorage (reanudación) y no de una generación recién hecha? El
  // runner usa esto para decidir si una carga fallida debe volver al setup (resume) o mostrar retry.
  const [resumedFromStorage, setResumedFromStorage] = useState<boolean>(() => readActiveAttempt() !== null);
  // Aviso chico al volver al setup porque no se pudo reanudar el intento guardado (404 / COMPLETED).
  const [resumeFailed, setResumeFailed] = useState(false);

  // Flujo "Historial".
  const [detailId, setDetailId] = useState<string | null>(null);

  // Setea (o limpia) el intento en progreso manteniendo memoria y localStorage en sincronía.
  const setActiveAttempt = (id: string | null) => {
    setAttemptId(id);
    writeActiveAttempt(id);
  };

  const startOver = () => {
    setActiveAttempt(null);
    setResult(null);
    setPhase('setup');
  };

  const onGenerated = (a: GeneratedAttempt) => {
    setActiveAttempt(a.attemptId);
    setResult(null);
    setResumedFromStorage(false); // generación fresca → no es una reanudación
    setResumeFailed(false);
    setPhase('running');
  };

  // El intento guardado no se pudo reanudar (carga 404/error o ya COMPLETED): limpiamos el localStorage
  // (vía setActiveAttempt(null)) y volvemos al setup con un aviso chico, en vez de atrapar al usuario.
  const onResumeFailed = () => {
    setActiveAttempt(null);
    setResult(null);
    setResumedFromStorage(false);
    setPhase('setup');
    setResumeFailed(true);
  };

  const onFinished = (r: QuizRunResult) => {
    setResult(r);
    setActiveAttempt(null); // intento COMPLETED → ya no es "en progreso"
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
          phase === 'running' && attemptId ? (
            <QuizRunner
              attemptId={attemptId}
              isResume={resumedFromStorage}
              onFinished={onFinished}
              onQuit={startOver}
              onResumeFailed={onResumeFailed}
            />
          ) : phase === 'results' && result ? (
            <QuizResults {...result} onRestart={startOver} />
          ) : (
            <div className="flex flex-col gap-3">
              {resumeFailed && (
                <div
                  role="status"
                  className="rounded-lg border border-border-subtle bg-bg-elevated px-3.5 py-2.5 text-sm text-text-secondary"
                >
                  {t('quiz.setup.resumeFailed')}
                </div>
              )}
              <QuizSetup onGenerated={onGenerated} />
            </div>
          )
        ) : detailId ? (
          <QuizAttemptDetail id={detailId} onBack={() => setDetailId(null)} />
        ) : (
          <QuizHistory onOpen={setDetailId} />
        )}
      </div>
    </PageWrapper>
  );
}
