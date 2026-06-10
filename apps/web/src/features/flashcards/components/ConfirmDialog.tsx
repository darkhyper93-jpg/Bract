import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string | undefined;
  loading?: boolean | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

// Confirmación destructiva reutilizable de Flashcards (borrar carta).
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-text-secondary">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} loading={loading ?? false}>
          {confirmLabel ?? t('common.delete')}
        </Button>
      </div>
    </Modal>
  );
}
