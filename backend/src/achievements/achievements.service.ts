import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { Achievement, AchievementMetric, Prisma } from '@prisma/client';
import { STARTER_ACHIEVEMENTS } from './achievements.config';
import { WeeklyTasksService } from '../weekly-tasks/weekly-tasks.service';
import { xpPerPixelForLevel } from '../rewards/rewards.config';
import { COLOR_PALETTES } from '../shop/shop.config';

type CounterField = 'pixelsPlaced' | 'publicationsCreated' | 'likesReceived';
type CounterMetric =
  | 'PIXELS_PLACED'
  | 'PUBLICATIONS_CREATED'
  | 'LIKES_RECEIVED';

@Injectable()
export class AchievementsService {
  constructor(
    private prisma: PrismaService,
    private rewards: RewardsService,
    private weeklyTasks: WeeklyTasksService,
  ) {}

  private readonly metricField: Record<CounterMetric, CounterField> = {
    PIXELS_PLACED: 'pixelsPlaced',
    PUBLICATIONS_CREATED: 'publicationsCreated',
    LIKES_RECEIVED: 'likesReceived',
  };

  // Otorga los logros recién completados y sus recompensas (idempotente)
  private async awardCompleted(userId: number, candidates: Achievement[]) {
    const completed: { key: string; name: string }[] = [];
    for (const a of candidates) {
      try {
        await this.prisma.userAchievement.create({
          data: { userId, achievementId: a.id },
        });
      } catch {
        continue; // ya estaba completado (carrera)
      }
      if (a.rewardBits > 0) await this.rewards.grantBits(userId, a.rewardBits);
      if (a.rewardXp > 0) await this.rewards.addXp(userId, a.rewardXp);
      if (a.rewardCosmeticKey)
        await this.rewards.grantCosmetic(userId, a.rewardCosmeticKey);
      completed.push({ key: a.key, name: a.name });
    }
    return completed;
  }

  // Sube un contador de por vida y revisa logros de esa métrica
  async track(userId: number, metric: AchievementMetric, increment = 1) {
    if (increment === 0) return [];
    const field = this.metricField[metric as CounterMetric];
    if (!field) return [];

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { [field]: { increment } } as Prisma.UserUpdateInput,
    });
    const value = user[field] as number;

    // XP por pixel pintado en el lienzo público (escala con el nivel)
    if (metric === 'PIXELS_PLACED') {
      await this.rewards.addXp(
        userId,
        xpPerPixelForLevel(user.level) * increment,
      );
    }

    const candidates = await this.prisma.achievement.findMany({
      where: {
        metric,
        active: true,
        threshold: { lte: value },
        unlocks: { none: { userId } },
      },
    });
    const completed = await this.awardCompleted(userId, candidates);
    await this.weeklyTasks.track(userId, metric, increment);
    await this.checkLevel(userId);
    return completed;
  }

  // Para likes: recuenta el total actual de likes del autor y revisa logros
  async recountLikes(ownerId: number) {
    const count = await this.prisma.publicationReaction.count({
      where: { type: 'LIKE', publication: { userId: ownerId } },
    });
    await this.prisma.user.update({
      where: { id: ownerId },
      data: { likesReceived: count },
    });
    const candidates = await this.prisma.achievement.findMany({
      where: {
        metric: 'LIKES_RECEIVED',
        active: true,
        threshold: { lte: count },
        unlocks: { none: { userId: ownerId } },
      },
    });
    return this.awardCompleted(ownerId, candidates);
  }

  // Revisa los logros de nivel contra el nivel actual del usuario
  async checkLevel(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];
    const candidates = await this.prisma.achievement.findMany({
      where: {
        metric: 'LEVEL_REACHED',
        active: true,
        threshold: { lte: user.level },
        unlocks: { none: { userId } },
      },
    });
    return this.awardCompleted(userId, candidates);
  }

  // Revisa los logros de colección contra cuántos cosméticos posee el usuario
  async checkCosmeticsOwned(userId: number) {
    const count = await this.prisma.userCosmetic.count({ where: { userId } });
    const candidates = await this.prisma.achievement.findMany({
      where: {
        metric: 'COSMETICS_OWNED',
        active: true,
        threshold: { lte: count },
        unlocks: { none: { userId } },
      },
    });
    return this.awardCompleted(userId, candidates);
  }

  // Otorga logros de una métrica comparando su umbral contra un valor ya calculado
  private async awardByMetric(
    userId: number,
    metric: AchievementMetric,
    value: number,
  ) {
    const candidates = await this.prisma.achievement.findMany({
      where: {
        metric,
        active: true,
        threshold: { lte: value },
        unlocks: { none: { userId } },
      },
    });
    return this.awardCompleted(userId, candidates);
  }

  // Cuántas paletas completas posee el usuario (tiene todos sus colores)
  private async palettesCompleted(userId: number): Promise<number> {
    const owned = await this.prisma.userCosmetic.findMany({
      where: { userId },
      select: { cosmetic: { select: { key: true } } },
    });
    const ownedKeys = new Set(owned.map((o) => o.cosmetic.key));
    return COLOR_PALETTES.filter((p) =>
      p.colorKeys.every((k) => ownedKeys.has(k)),
    ).length;
  }

  // Revisa todos los logros de colección (cantidad, rareza y paletas) tras una compra
  async checkCollection(userId: number) {
    await this.checkCosmeticsOwned(userId);

    const legendary = await this.prisma.userCosmetic.count({
      where: { userId, cosmetic: { rarity: 'LEGENDARY' } },
    });
    const mythic = await this.prisma.userCosmetic.count({
      where: { userId, cosmetic: { rarity: 'MYTHIC' } },
    });
    const palettes = await this.palettesCompleted(userId);

    await this.awardByMetric(userId, 'LEGENDARY_OWNED', legendary);
    await this.awardByMetric(userId, 'MYTHIC_OWNED', mythic);
    await this.awardByMetric(userId, 'PALETTE_COMPLETED', palettes);

    await this.checkLevel(userId);
  }

  async listForUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    const cosmeticsOwned = await this.prisma.userCosmetic.count({
      where: { userId },
    });
    const legendaryOwned = await this.prisma.userCosmetic.count({
      where: { userId, cosmetic: { rarity: 'LEGENDARY' } },
    });
    const mythicOwned = await this.prisma.userCosmetic.count({
      where: { userId, cosmetic: { rarity: 'MYTHIC' } },
    });
    const palettesComplete = await this.palettesCompleted(userId);

    const achievements = await this.prisma.achievement.findMany({
      where: { active: true },
      orderBy: [{ metric: 'asc' }, { threshold: 'asc' }],
    });

    const done = await this.prisma.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true, completedAt: true },
    });

    const doneMap = new Map(done.map((d) => [d.achievementId, d.completedAt]));

    const valueFor = (metric: AchievementMetric): number => {
      switch (metric) {
        case 'PIXELS_PLACED':
          return user.pixelsPlaced;
        case 'PUBLICATIONS_CREATED':
          return user.publicationsCreated;
        case 'LIKES_RECEIVED':
          return user.likesReceived;
        case 'LEVEL_REACHED':
          return user.level;
        case 'COSMETICS_OWNED':
          return cosmeticsOwned;
        case 'LEGENDARY_OWNED':
          return legendaryOwned;
        case 'MYTHIC_OWNED':
          return mythicOwned;
        case 'PALETTE_COMPLETED':
          return palettesComplete;
        default:
          return 0;
      }
    };

    return achievements.map((a) => {
      const completed = doneMap.has(a.id);
      const value = valueFor(a.metric);
      return {
        key: a.key,
        name: a.name,
        description: a.description,
        metric: a.metric,
        threshold: a.threshold,
        progress: Math.min(value, a.threshold),
        completed,
        completedAt: completed ? doneMap.get(a.id) : null,
        rewardXp: a.rewardXp,
        rewardBits: a.rewardBits,
      };
    });
  }

  async seedCatalog(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isAdmin) throw new ForbiddenException('Solo administradores');
    for (const a of STARTER_ACHIEVEMENTS) {
      await this.prisma.achievement.upsert({
        where: { key: a.key },
        update: {
          name: a.name,
          description: a.description,
          metric: a.metric,
          threshold: a.threshold,
          rewardXp: a.rewardXp,
          rewardBits: a.rewardBits,
          rewardCosmeticKey: a.rewardCosmeticKey ?? null,
        },
        create: {
          key: a.key,
          name: a.name,
          description: a.description,
          metric: a.metric,
          threshold: a.threshold,
          rewardXp: a.rewardXp,
          rewardBits: a.rewardBits,
          rewardCosmeticKey: a.rewardCosmeticKey ?? null,
        },
      });
    }
    return { success: true, seeded: STARTER_ACHIEVEMENTS.length };
  }
}
