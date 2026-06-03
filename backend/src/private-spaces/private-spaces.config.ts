export const PRIVATE_SPACE_CONFIG = {
  MIN_PIXELS: 64, // mínimo 8 px por lado
  MAX_SIDE: 100, // máximo 100 px por lado (100×100 = 10,000 px máx por espacio)
  MAX_SPACES_PER_USER: 3, // máximo de espacios activos por usuario
  MAX_TOTAL_PIXELS_PER_USER: 15000, // tope acumulado de píxeles privados por usuario

  MONTHLY_PRICE_PER_PIXEL_CENTS: 1, // $0.01/px al mes
  PERMANENT_BASE_PRICE_PER_PIXEL_CENTS: 10, // $0.10/px (antes de descuento)

  // Descuento por volumen (solo permanente), según el total de píxeles de la compra
  PERMANENT_VOLUME_DISCOUNTS: [
    { upTo: 1000, discount: 0 },
    { upTo: 4000, discount: 0.15 },
    { upTo: 7000, discount: 0.25 },
    { upTo: Infinity, discount: 0.35 },
  ] as { upTo: number; discount: number }[],
};

export function computePriceCents(
  pixels: number,
  purchaseType: 'MONTHLY' | 'PERMANENT',
): number {
  if (purchaseType === 'MONTHLY') {
    return pixels * PRIVATE_SPACE_CONFIG.MONTHLY_PRICE_PER_PIXEL_CENTS;
  }
  const tier = PRIVATE_SPACE_CONFIG.PERMANENT_VOLUME_DISCOUNTS.find(
    (t) => pixels <= t.upTo,
  );
  const discount = tier ? tier.discount : 0;
  const base =
    pixels * PRIVATE_SPACE_CONFIG.PERMANENT_BASE_PRICE_PER_PIXEL_CENTS;
  return Math.round(base * (1 - discount));
}
