import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RewardsService } from '../rewards/rewards.service';
import { AchievementMetric } from '@prisma/client';
import { STARTER_WEEKLY_TASKS, currentWeekKey } from './weekly-tasks.config';
import { RewardEvent } from '../achievements/reward-event';

@Injectable()
export class WeeklyTasksService {
  constructor(
    private prisma: PrismaService,
    private rewards: RewardsService,
  ) {}

  // Suma progreso semanal para las tareas de esta métrica y otorga si se completan
  async track(
    userId: number,
    metric: AchievementMetric,
    increment = 1,
  ): Promise<RewardEvent[]> {
    if (increment === 0) return [];
    const weekKey = currentWeekKey();

    const tasks = await this.prisma.weeklyTask.findMany({
      where: { metric, active: true },
    });

    const completed: RewardEvent[] = [];

    for (const t of tasks) {
      const row = await this.prisma.userWeeklyTask.upsert({
        where: {
          userId_weeklyTaskId_weekKey: { userId, weeklyTaskId: t.id, weekKey },
        },
        update: { progress: { increment } },
        create: { userId, weeklyTaskId: t.id, weekKey, progress: increment },
      });

      if (!row.completed && row.progress >= t.threshold) {
        const res = await this.prisma.userWeeklyTask.updateMany({
          where: { id: row.id, completed: false },
          data: { completed: true, completedAt: new Date() },
        });
        if (res.count > 0) {
          if (t.rewardBits > 0)
            await this.rewards.grantBits(userId, t.rewardBits);
          if (t.rewardXp > 0) await this.rewards.addXp(userId, t.rewardXp);
          if (t.rewardCosmeticKey)
            await this.rewards.grantCosmetic(userId, t.rewardCosmeticKey);
          completed.push({
            type: 'WEEKLY_TASK',
            key: t.key,
            name: t.name,
            rewardBits: t.rewardBits,
          });
        }
      }
    }

    return completed;
  }

  async listForUser(userId: number) {
    const weekKey = currentWeekKey();
    const tasks = await this.prisma.weeklyTask.findMany({
      where: { active: true },
      orderBy: { threshold: 'asc' },
    });
    const rows = await this.prisma.userWeeklyTask.findMany({
      where: { userId, weekKey },
    });
    const rowMap = new Map(rows.map((r) => [r.weeklyTaskId, r]));

    return tasks.map((t) => {
      const row = rowMap.get(t.id);
      return {
        key: t.key,
        name: t.name,
        description: t.description,
        threshold: t.threshold,
        progress: Math.min(row?.progress ?? 0, t.threshold),
        completed: row?.completed ?? false,
        rewardXp: t.rewardXp,
        rewardBits: t.rewardBits,
        weekKey,
      };
    });
  }

  async seedCatalog(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isAdmin) throw new ForbiddenException('Solo administradores');
    for (const t of STARTER_WEEKLY_TASKS) {
      await this.prisma.weeklyTask.upsert({
        where: { key: t.key },
        update: {
          name: t.name,
          description: t.description,
          metric: t.metric,
          threshold: t.threshold,
          rewardXp: t.rewardXp,
          rewardBits: t.rewardBits,
          rewardCosmeticKey: t.rewardCosmeticKey ?? null,
          active: true,
        },
        create: {
          key: t.key,
          name: t.name,
          description: t.description,
          metric: t.metric,
          threshold: t.threshold,
          rewardXp: t.rewardXp,
          rewardBits: t.rewardBits,
          rewardCosmeticKey: t.rewardCosmeticKey ?? null,
        },
      });
    }
    return { success: true, seeded: STARTER_WEEKLY_TASKS.length };
  }
}
