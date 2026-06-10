import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import type { Flashcard, CreateFlashcardInput } from '@bract/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import { flashcardFormSchema, type FlashcardFormValues } from '../schemas/flashcards.form.schema';
import { useFlashcardMutations } from '../hooks/useFlashcardMutations';

interface FlashcardFormModalProps {
  open: boolean;
  onClose: () => void;
  topicId: string;
  flashcard?: Flashcard | undefined; // presente → edición
}

export function FlashcardFormModal({ open, onClose, topicId, flashcard }: FlashcardFormModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { create, update } = useFlashcardMutations();
  const isEdit = Boolean(flashcard);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FlashcardFormValues>({
    resolver: zodResolver(flashcardFormSchema),
    defaultValues: { question: flashcard?.question ?? '', answer: flashcard?.answer ?? '' },
  });

  // Reset al abrir/cambiar de carta (el modal se monta una vez y se reusa).
  React.useEffect(() => {
    if (open) {
      reset({ question: flashcard?.question ?? '', answer: flashcard?.answer ?? '' });
    }
  }, [open, flashcard, reset]);

  const onSubmit = (values: FlashcardFormValues) => {
    const onSuccess = () => {
      toast.success(t(isEdit ? 'flashcards.toast.updated' : 'flashcards.toast.created'));
      onClose();
    };
    const onError = () => toast.error(t('flashcards.toast.error'));

    if (isEdit && flashcard) {
      update.mutate({ id: flashcard.id, input: values }, { onSuccess, onError });
    } else {
      const input: CreateFlashcardInput = { topicId, ...values };
      create.mutate(input, { onSuccess, onError });
    }
  };

  const isPending = create.isPending || update.isPending;
  const fieldError = (msg?: string) => (msg ? t(`flashcards.form.${msg}`) : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(isEdit ? 'flashcards.form.editTitle' : 'flashcards.form.newTitle')}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label={t('flashcards.form.question')}
          placeholder={t('flashcards.form.questionPlaceholder')}
          error={fieldError(errors.question?.message)}
          autoFocus
          {...register('question')}
        />
        <Input
          label={t('flashcards.form.answer')}
          placeholder={t('flashcards.form.answerPlaceholder')}
          error={fieldError(errors.answer?.message)}
          {...register('answer')}
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
