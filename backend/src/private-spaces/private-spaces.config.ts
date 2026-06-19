export const PRIVATE_SPACE_CONFIG = {
  MIN_SIDE: 4,
  MIN_PIXELS: 64, // mínimo 8 px por lado
  MAX_SIDE: 100, // máximo 100 px por lado (100×100 = 10,000 px máx por espacio)
  MAX_SPACES_PER_USER: 3,
  MAX_TOTAL_PIXELS_PER_USER: 15000,

  // Precio en Bits
  BASE_BITS_PER_PIXEL: 1, // 1 Bit/px/mes en la orilla (multiplicador 1.0)
  MAX_LOCATION_MULTIPLIER: 2.5, // M: el centro cuesta hasta 2.5× la orilla

  // Tope global de área privada (20% del lienzo de 1000×1000)
  GLOBAL_PIXEL_CAP: 200000,

  CANVAS_SIZE: 1000,
};

const CENTER = (PRIVATE_SPACE_CONFIG.CANVAS_SIZE - 1) / 2; // 499.5
const HALF = (PRIVATE_SPACE_CONFIG.CANVAS_SIZE - 1) / 2; // 499.5

export function locationMultiplier(cx: number, cy: number): number {
  const cheby = Math.max(Math.abs(cx - CENTER), Math.abs(cy - CENTER));
  const centrality = Math.max(0, 1 - cheby / HALF); // 1 en el centro, 0 en el borde
  return 1 + (PRIVATE_SPACE_CONFIG.MAX_LOCATION_MULTIPLIER - 1) * centrality;
}

export function computeMonthlyBits(
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): number {
  const pixels = (maxX - minX + 1) * (maxY - minY + 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return Math.round(
    pixels *
      PRIVATE_SPACE_CONFIG.BASE_BITS_PER_PIXEL *
      locationMultiplier(cx, cy),
  );
}
