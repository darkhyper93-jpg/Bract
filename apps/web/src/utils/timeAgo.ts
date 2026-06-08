export function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  if (diff < 60_000) return 'Hace un momento';
  if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Hace ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 172_800_000) return 'Ayer';
  return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
