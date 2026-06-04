import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { Achievement, AchievementMetric, Prisma } from '@prisma/client';
import { STARTER_ACHIEVEMENTS } from './achievements.config';
import { WeeklyTasksService } from '../weekly-tasks/weekly-tasks.service';

type CounterField = 'pixelsPlaced' | 'publicationsCreated' | 'likesReceived';

@Injectable()
export class AchievementsService {
  constructor(
    private prisma: PrismaService,
    private rewards: RewardsService,
    private weeklyTasks: WeeklyTasksService,
  ) {}

  private readonly metricField: Record<AchievementMetric, CounterField> = {
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
    const field = this.metricField[metric];

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { [field]: { increment } } as Prisma.UserUpdateInput,
    });
    const value = user[field] as number;

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

  async listForUser(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];

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
