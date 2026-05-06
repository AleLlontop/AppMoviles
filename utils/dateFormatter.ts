import dayjs from 'dayjs';
import 'dayjs/locale/es';

export function formatSeconds(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatHM(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatTimeOnly(isoString: string) {
  const date = dayjs(isoString);
  return date.format('H[h] mm[m]');
}

export function formatDateLabel(isoString: string) {
  // Returns something like 'lun., 27 abr.'
  dayjs.locale('es');
  return dayjs(isoString).format('ddd., D MMM.');
}

export function formatFullDateLabel(isoString: string) {
  // Returns 'mar., 28 abr. 2026'
  dayjs.locale('es');
  return dayjs(isoString).format('ddd., D MMM. YYYY');
}
