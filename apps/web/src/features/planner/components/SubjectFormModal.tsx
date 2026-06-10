import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { SUBJECT_COLORS, type Subject, type CreateSubjectInput } from '@bract/shared';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { cn } from '../../../utils/cn';
import { useToast } from '../../../hooks/useToast';
import { subjectFormSchema, type SubjectFormValues } from '../schemas/planner.form.schema';
import { useSubjectMutations } from '../hooks/useSubjectMutations';

interface SubjectFormModalProps {
  open: boolean;
  onClose: () => void;
  subject?: Subject | undefined; // presente → edición
}

// yyyy-mm-dd (input date) → ISO medianoche UTC | null. '' = limpiar la fecha.
function toExamDateInput(values: SubjectFormValues): string | null {
  if (!values.examDate) return null;
  return `${values.examDate}T00:00:00.000Z`;
}

export function SubjectFormModal({ open, onClose, subject }: SubjectFormModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { create, update } = useSubjectMutations();
  const isEdit = Boolean(subject);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: {
      name: subject?.name ?? '',
      examDate: subject?.examDate ? subject.examDate.slice(0, 10) : '',
      ...(subject?.color ? { color: subject.color as SubjectFormValues['color'] } : {}),
    },
  });

  // Reset al abrir/cambiar de materia (el modal se monta una vez y se reusa).
  React.useEffect(() => {
    if (open) {
      reset({
        name: subject?.name ?? '',
        examDate: subject?.examDate ? subject.examDate.slice(0, 10) : '',
        ...(subject?.color ? { color: subject.color as SubjectFormValues['color'] } : {}),
      });
    }
  }, [open, subject, reset]);

  const selectedColor = watch('color');

  const onSubmit = (values: SubjectFormValues) => {
    const input: CreateSubjectInput = {
      name: values.name,
      examDate: toExamDateInput(values),
      color: values.color ?? null,
    };
    const onSuccess = () => {
      toast.success(t(isEdit ? 'planner.toast.subjectUpdated' : 'planner.toast.subjectCreated'));
      onClose();
    };
    const onError = () => toast.error(t('planner.toast.error'));

    if (isEdit && subject) {
      update.mutate({ id: subject.id, input }, { onSuccess, onError });
    } else {
      create.mutate(input, { onSuccess, onError });
    }
  };

  const isPending = create.isPending || update.isPending;
  const fieldError = (msg?: string) => (msg ? t(`planner.form.${msg}`) : undefined);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t(isEdit ? 'planner.form.editSubject' : 'planner.form.newSubject')}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input
          label={t('planner.form.subjectName')}
          placeholder={t('planner.form.subjectNamePlaceholder')}
          error={fieldError(errors.name?.message)}
          autoFocus
          {...register('name')}
        />

        <Input
          type="date"
          label={t('planner.form.examDate')}
          error={fieldError(errors.examDate?.message)}
          {...register('examDate')}
        />

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-secondary">{t('planner.form.color')}</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('planner.form.color')}>
            {SUBJECT_COLORS.map((color) => {
              const active = selectedColor === color;
              return (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() =>
                    setValue('color', active ? undefined : color, { shouldDirty: true })
                  }
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-transform duration-[150ms]',
                    active
                      ? 'border-text-primary scale-110'
                      : 'border-transparent hover:scale-105',
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              );
            })}
          </div>
        </div>

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
