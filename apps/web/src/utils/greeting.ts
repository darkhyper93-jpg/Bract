// Saludo según la hora del día. Compartido por el Home del estudiante (§8.10) y el
// DashboardPage admin — una sola fuente de la lógica; cada namespace i18n provee su copy.
export type GreetingKey = 'greetingMorning' | 'greetingAfternoon' | 'greetingEvening';

export function greetingKey(date: Date = new Date()): GreetingKey {
  const hour = date.getHours();
  if (hour < 12) return 'greetingMorning';
  if (hour < 18) return 'greetingAfternoon';
  return 'greetingEvening';
}
