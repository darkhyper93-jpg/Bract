import type { TFunction } from 'i18next';
import { QuizScope } from '@bract/shared';

// El server persiste el NOMBRE PROPIO en scopeName (tema para TOPIC, materia para SUBJECT/MULTI_TOPIC).
// La etiqueta visible se compone acá con i18n (es/en) usando scope + topicCount: para MULTI_TOPIC →
// "N temas de X" / "N topics from X"; para TOPIC/SUBJECT → el nombre propio tal cual.
export function scopeLabel(
  t: TFunction,
  attempt: { scope: QuizScope; scopeName: string; topicCount: number },
): string {
  if (attempt.scope === QuizScope.MULTI_TOPIC) {
    return t('quiz.scope.multi', { count: attempt.topicCount, subject: attempt.scopeName });
  }
  return attempt.scopeName;
}

// Etiqueta corta del badge según el scope (Tema · Materia · Varios temas).
export function scopeBadgeLabel(t: TFunction, scope: QuizScope): string {
  switch (scope) {
    case QuizScope.TOPIC:
      return t('quiz.history.scopeTopic');
    case QuizScope.SUBJECT:
      return t('quiz.history.scopeSubject');
    case QuizScope.MULTI_TOPIC:
      return t('quiz.history.scopeMulti');
  }
}
