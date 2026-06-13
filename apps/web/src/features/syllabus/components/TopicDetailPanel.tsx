import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AxiosError } from 'axios';
import type { Topic, ReviewQuality } from '@bract/shared';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import { StatusBadge, DifficultyBadge } from '../../planner';
import { StudyDeck, useFlashcards, useFlashcardMutations } from '../../flashcards';
import type { ChatFocusTopic, ChatLocationState } from '../../chat';

function IconSparkles() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

function IconMessageCircle() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
    </svg>
  );
}

// Extrae el `error.code` del envelope de la API para distinguir AI_UNAVAILABLE del resto.
function apiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: { code?: string } } | undefined;
    return data?.error?.code;
  }
  return undefined;
}

interface TopicDetailPanelProps {
  topic: Topic;
  subjectName: string;
  onBack: () => void;
}

// Detalle de un tema (panel derecho del Temario §8.7): el flujo centrado en el TEMA con sus
// herramientas a mano. Estudio de flashcards on-demand (todas las cartas del tema, reusa StudyDeck)
// y deep-link al chat enfocado en el tema. Read-only respecto al CRUD del tema (eso vive en el planner).
export function TopicDetailPanel({ topic, subjectName, onBack }: TopicDetailPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  // On-demand: TODAS las cartas del tema (no la cola `due`) → funciona aunque el tema esté pausado en SRS.
  const { flashcards, isLoading, isError, refetch } = useFlashcards(topic.id);
  const { review, generate } = useFlashcardMutations();

  const handleReview = (id: string, quality: ReviewQuality) => {
    review.mutate({ id, quality }, { onError: () => toast.error(t('flashcards.toast.error')) });
  };

  const handleGenerate = () => {
    generate.mutate(
      { topicId: topic.id },
      {
        onSuccess: (cards) => toast.success(t('flashcards.toast.generated', { count: cards.length })),
        onError: (err) =>
          toast.error(
            apiErrorCode(err) === 'AI_UNAVAILABLE'
              ? t('flashcards.toast.aiUnavailable')
              : t('flashcards.toast.error'),
          ),
      },
    );
  };

  const askChat = () => {
    const focusTopic: ChatFocusTopic = { name: topic.name, subjectName };
    const state: ChatLocationState = { focusTopic };
    navigate('/chat', { state });
  };

  const generateAction = (
    <Button leftIcon={<IconSparkles />} loading={generate.isPending} onClick={handleGenerate}>
      {t('flashcards.manage.generate')}
    </Button>
  );

  return (
    <div className="flex h-full flex-col rounded-lg border border-border-subtle bg-bg-surface">
      {/* Header con back en mobile */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-subtle px-3 lg:hidden">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-text-secondary transition-colors duration-[150ms] hover:bg-bg-elevated hover:text-text-primary"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {t('syllabus.detail.back')}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
        {/* Cabecera del tema */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-text-primary">{topic.name}</h3>
            <StatusBadge status={topic.status} />
            <DifficultyBadge difficulty={topic.difficulty} />
          </div>
          <p className="mt-1 text-sm text-text-tertiary">{subjectName}</p>
          {topic.description && (
            <p className="mt-3 whitespace-pre-line text-sm text-text-secondary">{topic.description}</p>
          )}
        </div>

        {/* Acción: preguntar al chat enfocado en el tema */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" leftIcon={<IconMessageCircle />} onClick={askChat}>
            {t('syllabus.detail.askChat')}
          </Button>
        </div>

        {/* Estudio on-demand de las flashcards del tema */}
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-text-primary">{t('syllabus.detail.studyTitle')}</h4>
          <StudyDeck
            cards={flashcards}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void refetch()}
            onReview={handleReview}
            getHeading={() => ({ title: topic.name, subtitle: subjectName })}
            emptyTitle={t('syllabus.detail.noCards')}
            emptyDescription={t('syllabus.detail.noCardsDescription')}
            emptyAction={generateAction}
          />
        </div>
      </div>
    </div>
  );
}
