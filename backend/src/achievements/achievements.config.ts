import { AchievementMetric } from '@prisma/client';

type SeedAchievement = {
  key: string;
  name: string;
  description: string;
  metric: AchievementMetric;
  threshold: number;
  rewardXp: number;
  rewardBits: number;
  rewardCosmeticKey?: string;
};

export const STARTER_ACHIEVEMENTS: SeedAchievement[] = [
  {
    key: 'pixels_100',
    name: 'Primeros trazos',
    description: 'Coloca 100 píxeles.',
    metric: 'PIXELS_PLACED',
    threshold: 100,
    rewardXp: 50,
    rewardBits: 20,
  },
  {
    key: 'pixels_1000',
    name: 'Pintor dedicado',
    description: 'Coloca 1 000 píxeles.',
    metric: 'PIXELS_PLACED',
    threshold: 1000,
    rewardXp: 150,
    rewardBits: 75,
  },
  {
    key: 'pixels_10000',
    name: 'Maestro del lienzo',
    description: 'Coloca 10 000 píxeles.',
    metric: 'PIXELS_PLACED',
    threshold: 10000,
    rewardXp: 500,
    rewardBits: 300,
  },
  {
    key: 'pubs_1',
    name: 'Primera obra',
    description: 'Crea tu primera publicación.',
    metric: 'PUBLICATIONS_CREATED',
    threshold: 1,
    rewardXp: 30,
    rewardBits: 15,
  },
  {
    key: 'pubs_10',
    name: 'Galería',
    description: 'Crea 10 publicaciones.',
    metric: 'PUBLICATIONS_CREATED',
    threshold: 10,
    rewardXp: 200,
    rewardBits: 100,
  },
  {
    key: 'likes_50',
    name: 'Reconocido',
    description: 'Recibe 50 likes en tus obras.',
    metric: 'LIKES_RECEIVED',
    threshold: 50,
    rewardXp: 200,
    rewardBits: 100,
  },
];
