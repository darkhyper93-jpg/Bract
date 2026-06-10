import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import { usePlan } from '../hooks/usePlan';
import { usePlanMutations } from '../hooks/usePlanMutations';
import { SubjectsPanel } from './SubjectsPanel';
import { AvailabilityPanel } from './AvailabilityPanel';
import { PlanView } from './PlanView';

function IconSparkles() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

export default function PlannerPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { plan } = usePlan();
  const { generate } = usePlanMutations();

  const handleGenerate = () => {
    generate.mutate(undefined, {
      onSuccess: () => toast.success(t('planner.toast.planGenerated')),
      onError: () => toast.error(t('planner.toast.error')),
    });
  };

  const hasPlan = plan !== null;

  return (
    <PageWrapper
      title={t('planner.title')}
      description={t('planner.description')}
      actions={
        <Button leftIcon={<IconSparkles />} loading={generate.isPending} onClick={handleGenerate}>
          {t(hasPlan ? 'planner.regenerate' : 'planner.generate')}
        </Button>
      }
    >
      <PlanView onGenerate={handleGenerate} isGenerating={generate.isPending} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SubjectsPanel />
        </div>
        <div className="lg:col-span-1">
          <AvailabilityPanel />
        </div>
      </div>
    </PageWrapper>
  );
}
