import { CosmeticType, CosmeticRarity, Prisma } from '@prisma/client';

type ShopCosmetic = {
  key: string;
  type: CosmeticType;
  name: string;
  description: string;
  rarity: CosmeticRarity;
  priceBits: number;
  data?: Prisma.InputJsonValue;
};

export const SHOP_COSMETICS: ShopCosmetic[] = [
  // Comunes
  {
    key: 'title_aprendiz',
    type: 'TITLE',
    name: 'Aprendiz',
    description: 'Apenas empiezas tu camino.',
    rarity: 'COMMON',
    priceBits: 120,
  },
  {
    key: 'title_pixelero',
    type: 'TITLE',
    name: 'Pixelero',
    description: 'Pixel a pixel se hace el lienzo.',
    rarity: 'COMMON',
    priceBits: 200,
  },
  {
    key: 'badge_chispa',
    type: 'BADGE',
    name: 'Chispa',
    description: 'Una pequeña chispa creativa.',
    rarity: 'COMMON',
    priceBits: 150,
    data: { icon: 'star' },
  },
  // Raros
  {
    key: 'title_virtuoso',
    type: 'TITLE',
    name: 'Virtuoso',
    description: 'Dominas el arte del pixel.',
    rarity: 'RARE',
    priceBits: 500,
    data: { color: '#4ADE80' },
  },
  {
    key: 'badge_corona',
    type: 'BADGE',
    name: 'Corona',
    description: 'Para quien reina en el lienzo.',
    rarity: 'RARE',
    priceBits: 650,
    data: { icon: 'crown' },
  },
  // Premium
  {
    key: 'title_leyenda_shop',
    type: 'TITLE',
    name: 'Leyenda',
    description: 'Reservado para los grandes.',
    rarity: 'PREMIUM',
    priceBits: 1200,
    data: { color: '#FF7A1A' },
  },
  // Marcos
  {
    key: 'frame_acero',
    type: 'FRAME',
    name: 'Acero',
    description: 'Un marco sobrio.',
    rarity: 'COMMON',
    priceBits: 220,
    data: { ring: '#A8A8B0' },
  },
  {
    key: 'frame_neon',
    type: 'FRAME',
    name: 'Neón',
    description: 'Brillo de neón alrededor.',
    rarity: 'RARE',
    priceBits: 600,
    data: { ring: 'linear-gradient(135deg,#60A5FA,#A78BFA)' },
  },
  {
    key: 'frame_oro',
    type: 'FRAME',
    name: 'Oro',
    description: 'Solo para los grandes.',
    rarity: 'PREMIUM',
    priceBits: 1300,
    data: { ring: 'linear-gradient(135deg,#FFD700,#FFA500)' },
  },
  // Fondos
  {
    key: 'bg_menta',
    type: 'BACKGROUND',
    name: 'Menta',
    description: 'Un fondo fresco.',
    rarity: 'COMMON',
    priceBits: 220,
    data: { background: 'linear-gradient(160deg,#1b2b26,#16241f)' },
  },
  {
    key: 'bg_atardecer',
    type: 'BACKGROUND',
    name: 'Atardecer',
    description: 'Tonos de ocaso.',
    rarity: 'RARE',
    priceBits: 650,
    data: { background: 'linear-gradient(160deg,#3a1f2e,#1f1626)' },
  },
  {
    key: 'bg_espacio',
    type: 'BACKGROUND',
    name: 'Espacio',
    description: 'Pierde la mirada en el cosmos.',
    rarity: 'PREMIUM',
    priceBits: 1300,
    data: { background: 'linear-gradient(160deg,#0f1030,#1a1040)' },
  },
  // Colores exóticos
  {
    key: 'color_tornasol_fuego',
    type: 'COLOR',
    name: 'Tornasol Fuego',
    description: 'Degradado ardiente.',
    rarity: 'RARE',
    priceBits: 200,
    data: {
      token: 'fade:#FF3B3B,#FFD93B',
      swatch: 'linear-gradient(135deg,#FF3B3B,#FFD93B)',
    },
  },
  {
    key: 'color_tornasol_oceano',
    type: 'COLOR',
    name: 'Tornasol Océano',
    description: 'Del turquesa al azul profundo.',
    rarity: 'RARE',
    priceBits: 200,
    data: {
      token: 'fade:#22D3EE,#3B5BFF',
      swatch: 'linear-gradient(135deg,#22D3EE,#3B5BFF)',
    },
  },
  {
    key: 'color_plata',
    type: 'COLOR',
    name: 'Plata',
    description: 'Brillo metálico plateado.',
    rarity: 'RARE',
    priceBits: 250,
    data: {
      token: 'fade:#FFFFFF,#8A8F94',
      swatch: 'linear-gradient(135deg,#FFFFFF,#C0C0C0,#8A8F94)',
    },
  },
  {
    key: 'color_oro',
    type: 'COLOR',
    name: 'Oro',
    description: 'Brillo metálico dorado.',
    rarity: 'PREMIUM',
    priceBits: 300,
    data: {
      token: 'fade:#FFF3B0,#B8860B',
      swatch: 'linear-gradient(135deg,#FFF3B0,#FFD700,#B8860B)',
    },
  },
  {
    key: 'color_arcoiris',
    type: 'COLOR',
    name: 'Arcoíris',
    description: 'Todo el espectro.',
    rarity: 'PREMIUM',
    priceBits: 350,
    data: {
      token: 'rainbow',
      swatch: 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f)',
    },
  },
];

export const COLOR_PALETTES = [
  {
    key: 'palette_exotica',
    name: 'Paleta Exótica',
    description: 'Los cinco colores exóticos, con descuento.',
    bundlePriceBits: 950,
    colorKeys: [
      'color_tornasol_fuego',
      'color_tornasol_oceano',
      'color_plata',
      'color_oro',
      'color_arcoiris',
    ],
  },
];
