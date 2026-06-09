import { AchievementMetric } from '@prisma/client';

// Clave ISO de la semana actual, ej. "2026-W23" (reinicio los lunes en UTC)
export function currentWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Lun=0 ... Dom=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // jueves de esta semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 +
    Math.round(
      (date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000),
    );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

type SeedWeeklyTask = {
  key: string;
  name: string;
  description: string;
  metric: AchievementMetric;
  threshold: number;
  rewardXp: number;
  rewardBits: number;
  rewardCosmeticKey?: string;
};

export const STARTER_WEEKLY_TASKS: SeedWeeklyTask[] = [
  {
    key: 'weekly_pixels_200',
    name: 'Pintor de la semana',
    description: 'Pinta 200 píxeles esta semana.',
    metric: 'PIXELS_PLACED',
    threshold: 200,
    rewardXp: 80,
    rewardBits: 40,
  },
  {
    key: 'weekly_pixels_500',
    name: 'Lienzo en llamas',
    description: 'Pinta 500 píxeles esta semana.',
    metric: 'PIXELS_PLACED',
    threshold: 500,
    rewardXp: 150,
    rewardBits: 80,
  },
  {
    key: 'weekly_pixels_1000',
    name: 'Maratón semanal',
    description: 'Pinta 1 000 píxeles esta semana.',
    metric: 'PIXELS_PLACED',
    threshold: 1000,
    rewardXp: 250,
    rewardBits: 150,
  },
  {
    key: 'weekly_pub_1',
    name: 'Obra semanal',
    description: 'Crea una publicación esta semana.',
    metric: 'PUBLICATIONS_CREATED',
    threshold: 1,
    rewardXp: 60,
    rewardBits: 30,
  },
  {
    key: 'weekly_pub_3',
    name: 'Trío creativo',
    description: 'Crea 3 publicaciones esta semana.',
    metric: 'PUBLICATIONS_CREATED',
    threshold: 3,
    rewardXp: 150,
    rewardBits: 90,
  },
  {
    key: 'weekly_likes_25',
    name: 'Aplausos de la semana',
    description: 'Recibe 25 likes esta semana.',
    metric: 'LIKES_RECEIVED',
    threshold: 25,
    rewardXp: 120,
    rewardBits: 70,
  },
];
