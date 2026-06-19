const PALETTE = [
  '#826BF0', // violeta (accent)
  '#E47A3B', // naranja
  '#2E9E6B', // verde
  '#E84A7F', // rosa
  '#3B82F6', // azul
  '#0EA5A4', // turquesa
  '#D9A93B', // amarillo
  '#E66B5C', // coral
];

export function avatarColorFromId(userId: string | null | undefined): string {
  if (!userId) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function avatarInitial(nickname?: string | null, fallback?: string | null): string {
  const src = (nickname || fallback || '?').trim();
  return (src[0] || '?').toUpperCase();
}
