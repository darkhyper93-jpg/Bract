import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { TopicDifficulty, type Topic, type CreateTopicInput } from '@bract/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { useToast } from '../../../hooks/useToast';
import { topicFormSchema, type TopicFormValues } from '../schemas/planner.form.schema';
import { useTopicMutations } from '../hooks/useTopicMutations';

interface TopicFormModalProps {
  open: boolean;
  onClose: () => void;
  subjectId: string;
  topic?: Topic | undefined; // presente → edición
}

export function TopicFormModal({ open, onClose, subjectId, topic }: TopicFormModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { create, update } = useTopicMutations();
  const isEdit = Boolean(topic);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      name: topic?.name ?? '',
      description: topic?.description ?? '',
      difficulty: topic?.difficulty ?? TopicDifficulty.MEDIUM,
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: topic?.name ?? '',
        description: topic?.description ?? '',
        difficulty: topic?.difficulty ?? TopicDifficulty.MEDIUM,
      });
    }
  }, [open, topic, reset]);

  const difficulty = watch('difficulty');

  const difficultyOptions = [
    { value: TopicDifficulty.EASY, label: t('planner.difficulty.EASY') },
    { value: TopicDifficulty.MEDIUM, label: t('planner.difficulty.MEDIUM') },
    { value: TopicDifficulty.HARD, label: t('planner.difficulty.HARD') },
  ];

  const onSubmit = (values: TopicFormValues) => {
    const input: CreateTopicInput = {
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : null,
      difficulty: values.difficulty,
    };
    const onSuccess = () => {
      toast.success(t(isEdit ? 'planner.toast.topicUpdated' : 'planner.toast.topicCreated'));
      onClose();
    };
    const onError = () => toast.error(t('planner.toast.error'));

    if (isEdit && topic) {
      update.mutate({ id: topic.id, input }, { onSuccess, onError });
    } else {
      create.mutate({ subjectId, input }, { onSuccess, onError });
    }
  };

  const isPending = create.isPending || update.isPending;
  const fieldError = (msg?: string) => (msg ? t(`planner.form.${msg}`) : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(isEdit ? 'planner.form.editTopic' : 'planner.form.newTopic')}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label={t('planner.form.topicName')}
          placeholder={t('planner.form.topicNamePlaceholder')}
          error={fieldError(errors.name?.message)}
          autoFocus
          {...register('name')}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="topic-description" className="text-sm font-medium text-text-secondary">
            {t('planner.form.topicDescription')}
          </label>
          <textarea
            id="topic-description"
            rows={3}
            className="w-full resize-none rounded-lg border border-border-default bg-bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary transition-colors duration-[150ms] focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
            {...register('description')}
          />
          {errors.description?.message && (
            <p className="text-xs text-error">{fieldError(errors.description.message)}</p>
          )}
        </div>

        <Select
          label={t('planner.form.difficulty')}
          options={difficultyOptions}
          value={difficulty}
          onChange={(v) => setValue('difficulty', v as TopicDifficulty, { shouldDirty: true })}
        />

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={isPending}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
