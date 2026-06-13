import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ExtractedTopic, ImportCommitResult } from '@bract/shared';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { useToast } from '../../../hooks/useToast';
import { ImportSourceStep } from './ImportSourceStep';
import { ImportPreview } from './ImportPreview';
import type { ImportTarget } from '../types';

interface PreviewState {
  target: ImportTarget;
  topics: ExtractedTopic[];
  truncated: boolean;
}

// Importación masiva de temas (Agente K: POR TEXTO + desde ARCHIVOS). Wizard en 2 pasos: elegir
// fuente (texto o archivo) → preview editable → confirmar (add/replace). Nada se crea sin que el
// usuario revise el preview. La fuente archivo se convierte a texto y reusa el MISMO paso 2.
export default function ImportPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const handleExtracted = (target: ImportTarget, topics: ExtractedTopic[], truncated: boolean) => {
    setPreview({ target, topics, truncated });
  };

  const handleCommitted = (result: ImportCommitResult) => {
    toast.success(t('import.toast.committed', { count: result.createdCount }));
    setPreview(null);
  };

  return (
    <PageWrapper title={t('import.title')} description={t('import.description')}>
      <div className="mx-auto w-full max-w-3xl">
        {preview === null ? (
          <ImportSourceStep onExtracted={handleExtracted} />
        ) : (
          <ImportPreview
            target={preview.target}
            initialTopics={preview.topics}
            truncated={preview.truncated}
            onBack={() => setPreview(null)}
            onCommitted={handleCommitted}
          />
        )}
      </div>
    </PageWrapper>
  );
}
