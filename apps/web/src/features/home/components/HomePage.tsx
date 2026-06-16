import { useTranslation } from 'react-i18next';
import { PageWrapper } from '../../../components/layout/PageWrapper';
import { useAuthStore } from '../../../stores/authStore';
import { greetingKey } from '../../../utils/greeting';
import { TodayPlan } from './TodayPlan';
import { FocusSection } from './FocusSection';
import { ProgressSummary } from './ProgressSummary';
import { SubjectsOverview } from './SubjectsOverview';

// Home del estudiante (§8.10): landing único para todos los roles. Bienvenida + plan de hoy /
// próximo examen + en qué enfocarte + progreso + materias. 100% reuso de endpoints existentes;
// cada sección maneja sus 4 estados y degrada de forma independiente.
export default function HomePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0] ?? t('home.greetingUser');
  const title = `${t(`home.${greetingKey()}`)}, ${firstName}`;

  return (
    <PageWrapper title={title} description={t('home.subtitle')}>
      <div className="grid gap-6 lg:grid-cols-2">
        <TodayPlan />
        <FocusSection />
      </div>
      <ProgressSummary />
      <SubjectsOverview />
    </PageWrapper>
  );
}
