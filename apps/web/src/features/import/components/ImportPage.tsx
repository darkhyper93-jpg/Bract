import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExtractedTopic, ImportCommitResult } from '@bract/shared';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { useToast } from '../../../hooks/useToast';
import { ImportTextForm } from './ImportTextForm';
import { ImportPreview } from './ImportPreview';
import type { ImportTarget } from '../types';

interface PreviewState {
  target: ImportTarget;
  topics: ExtractedTopic[];
}

// Importación masiva de temas POR TEXTO (Agente K). Wizard en 2 pasos: pegar texto → preview
// editable → confirmar (add/replace). Nada se crea sin que el usuario revise el preview.
export default function ImportPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const handleExtracted = (target: ImportTarget, topics: ExtractedTopic[]) => {
    setPreview({ target, topics });
  };

  const handleCommitted = (result: ImportCommitResult) => {
    toast.success(t('import.toast.committed', { count: result.createdCount }));
    setPreview(null);
  };

  return (
    <PageWrapper title={t('import.title')} description={t('import.description')}>
      <div className="mx-auto w-full max-w-3xl">
        {preview === null ? (
          <ImportTextForm onExtracted={handleExtracted} />
        ) : (
          <ImportPreview
            target={preview.target}
            initialTopics={preview.topics}
            onBack={() => setPreview(null)}
            onCommitted={handleCommitted}
          />
        )}
      </div>
    </PageWrapper>
  );
}
