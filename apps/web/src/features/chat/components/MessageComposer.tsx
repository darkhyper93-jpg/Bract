import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Textarea } from '../../../components/ui/Textarea';
import { Button } from '../../../components/ui/Button';

interface MessageComposerProps {
  disabled: boolean;
  onSend: (content: string) => void;
}

// Caja de envío: Enter envía, Shift+Enter hace salto de línea. Se bloquea mientras hay un stream.
export function MessageComposer({ disabled, onSend }: MessageComposerProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');

  function submit() {
    const content = value.trim();
    if (content.length === 0 || disabled) return;
    onSend(content);
    setValue('');
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border-subtle p-3">
      <div className="flex-1">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chat.thread.placeholder')}
          rows={1}
          maxLength={4000}
          className="max-h-40 min-h-[40px] resize-none"
          aria-label={t('chat.thread.placeholder')}
        />
      </div>
      <Button
        type="button"
        onClick={submit}
        loading={disabled}
        disabled={value.trim().length === 0}
        aria-label={t('chat.thread.send')}
      >
        {t('chat.thread.send')}
      </Button>
    </div>
  );
}
