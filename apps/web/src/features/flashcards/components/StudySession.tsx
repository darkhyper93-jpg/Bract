import { useTranslation } from 'react-i18next';
import type { FlashcardWithTopic, ReviewQuality } from '@bract/shared';
import { useToast } from '../../../hooks/useToast';
import { useDueFlashcards } from '../hooks/useDueFlashcards';
import { useFlashcardMutations } from '../hooks/useFlashcardMutations';
import { StudyDeck } from './StudyDeck';

// Pestaña "Estudiar" global: estudia la cola de repaso SRS (`due`) del usuario, que cruza varios
// temas/materias. Es un wrapper delgado sobre StudyDeck (el flujo mostrar→revelar→calificar vive
// ahí, compartido con el estudio on-demand por tema del Temario §8.7).
export function StudySession() {
  const { t } = useTranslation();
  const toast = useToast();
  const { flashcards, isLoading, isError, refetch } = useDueFlashcards();
  const { review } = useFlashcardMutations();

  const handleReview = (id: string, quality: ReviewQuality) => {
    review.mutate({ id, quality }, { onError: () => toast.error(t('flashcards.toast.error')) });
  };

  return (
    <StudyDeck<FlashcardWithTopic>
      cards={flashcards}
      isLoading={isLoading}
      isError={isError}
      onRetry={() => void refetch()}
      onReview={handleReview}
      getHeading={(card) => ({ title: card.topic.name, subtitle: card.topic.subjectName })}
      emptyTitle={t('flashcards.study.allDone')}
      emptyDescription={t('flashcards.study.allDoneDescription')}
    />
  );
}
