import { useTranslation } from 'react-i18next';
import { TopicStatus, TopicDifficulty } from '@bract/shared';
import { Badge, type BadgeProps } from '../../../components/ui/Badge';

type BadgeVariant = NonNullable<BadgeProps['variant']>;

const STATUS_VARIANT: Record<TopicStatus, BadgeVariant> = {
  [TopicStatus.PENDING]: 'neutral',
  [TopicStatus.IN_PROGRESS]: 'info',
  [TopicStatus.COMPLETED]: 'success',
};

const DIFFICULTY_VARIANT: Record<TopicDifficulty, BadgeVariant> = {
  [TopicDifficulty.EASY]: 'success',
  [TopicDifficulty.MEDIUM]: 'warning',
  [TopicDifficulty.HARD]: 'error',
};

export function StatusBadge({ status }: { status: TopicStatus }) {
  const { t } = useTranslation();
  return <Badge variant={STATUS_VARIANT[status]}>{t(`planner.status.${status}`)}</Badge>;
}

export function DifficultyBadge({ difficulty }: { difficulty: TopicDifficulty }) {
  const { t } = useTranslation();
  return (
    <Badge variant={DIFFICULTY_VARIANT[difficulty]} dot>
      {t(`planner.difficulty.${difficulty}`)}
    </Badge>
  );
}
