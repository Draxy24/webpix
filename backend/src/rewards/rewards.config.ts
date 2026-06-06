import { CosmeticType, CosmeticSource, Prisma } from '@prisma/client';

// Nombre visible de la moneda (cámbialo aquí cuando quieras, sin tocar nada más)
export const CURRENCY_NAME = 'Bit';
export const CURRENCY_NAME_PLURAL = 'Bits';

export const PROGRESSION_CONFIG = {
  BASE_XP: 100, // XP para subir del nivel 1 al 2
  GROWTH: 1.068, // ~1,000,000 XP acumulados para el nivel 100
  MAX_LEVEL: 100,
  LEVEL_UP_BITS: 50, // Bits otorgados por cada nivel ganado
};

export const LAUNCH_REWARD = {
  cosmeticKey: 'title_og',
  // AJUSTA estas fechas al mes real de lanzamiento.
  // Para PROBAR ahora, pon un rango amplio (start en el pasado, end en el futuro)
  // para que tu cuenta califique.
  start: new Date('2026-07-01'),
  end: new Date('2026-08-01'),
};

export function levelInfo(xp: number) {
  const { BASE_XP, GROWTH, MAX_LEVEL } = PROGRESSION_CONFIG;
  let level = 1;
  let consumed = 0;
  while (level < MAX_LEVEL) {
    const need = Math.round(BASE_XP * Math.pow(GROWTH, level - 1));
    if (xp - consumed >= need) {
      consumed += need;
      level += 1;
    } else {
      break;
    }
  }
  const xpForNext =
    level < MAX_LEVEL ? Math.round(BASE_XP * Math.pow(GROWTH, level - 1)) : 0;
  return { level, xpIntoLevel: xp - consumed, xpForNext };
}

// XP que otorga cada pixel pintado en el lienzo público, según el nivel.
// Sube en bandas para que los niveles altos no sean imposibles.
export function xpPerPixelForLevel(level: number): number {
  if (level < 25) return 1;
  if (level < 50) return 2;
  if (level < 75) return 3;
  return 4;
}

// Catálogo inicial para poder probar (se siembra con el endpoint admin/seed)
type StarterCosmetic = {
  key: string;
  type: CosmeticType;
  name: string;
  description: string;
  source: CosmeticSource;
  priceBits?: number;
  data?: Prisma.InputJsonValue;
};

export const STARTER_COSMETICS: StarterCosmetic[] = [
  {
    key: 'title_pionero',
    type: 'TITLE',
    name: 'Pionero',
    description: 'Estuviste aquí desde el principio.',
    source: 'EVENT',
  },
  {
    key: 'title_artista',
    type: 'TITLE',
    name: 'Artista',
    description: 'Para los que crean sin parar.',
    source: 'ACHIEVEMENT',
  },
  {
    key: 'title_leyenda',
    type: 'TITLE',
    name: 'Leyenda del Lienzo',
    description: 'Reservado para los grandes.',
    source: 'RANKING',
  },
  {
    key: 'badge_fundador',
    type: 'BADGE',
    name: 'Fundador',
    description: 'Insignia de los primeros usuarios.',
    source: 'EVENT',
    data: { icon: 'star' },
  },
  {
    key: 'badge_top10',
    type: 'BADGE',
    name: 'Top 10 Global',
    description: 'Terminaste en el Top 10 mundial.',
    source: 'RANKING',
    data: { icon: 'crown' },
  },
  {
    key: 'title_og',
    type: 'TITLE',
    name: 'OG',
    description: 'Estuviste desde el lanzamiento.',
    source: 'EVENT',
    data: { color: '#FFD700' },
  },
];
