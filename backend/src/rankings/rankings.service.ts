import { Injectable, ForbiddenException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { currentPeriod, previousPeriod, periodLabelEs } from './period';
import { RANKING_REWARD_BITS } from './rankings.config';

@Injectable()
export class RankingsService {
  constructor(private prisma: PrismaService) {}

  private async hydrate(grouped: { userId: number | null; count: number }[]) {
    const userIds = grouped.map((g) => g.userId!).filter((id) => id !== null);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, nickname: true, profilePic: true, country: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    return grouped.map((g) => ({
      nickname: userMap.get(g.userId!)?.nickname,
      profilePic: userMap.get(g.userId!)?.profilePic ?? null,
      country: userMap.get(g.userId!)?.country ?? null,
      count: g.count,
    }));
  }

  async pixelsGlobal(limit = 50) {
    const users = await this.prisma.user.findMany({
      where: { pixelsPlaced: { gt: 0 } },
      orderBy: { pixelsPlaced: 'desc' },
      take: limit,
      select: {
        nickname: true,
        profilePic: true,
        country: true,
        pixelsPlaced: true,
      },
    });
    return users.map((u) => ({
      nickname: u.nickname,
      profilePic: u.profilePic,
      country: u.country,
      count: u.pixelsPlaced,
    }));
  }

  async pixelsNational(country: string, limit = 50) {
    const users = await this.prisma.user.findMany({
      where: { country, pixelsPlaced: { gt: 0 } },
      orderBy: { pixelsPlaced: 'desc' },
      take: limit,
      select: {
        nickname: true,
        profilePic: true,
        country: true,
        pixelsPlaced: true,
      },
    });
    return users.map((u) => ({
      nickname: u.nickname,
      profilePic: u.profilePic,
      country: u.country,
      count: u.pixelsPlaced,
    }));
  }

  async creatorsGlobal(limit = 50) {
    const users = await this.prisma.user.findMany({
      where: { publicationsCreated: { gt: 0 } },
      orderBy: { publicationsCreated: 'desc' },
      take: limit,
      select: {
        nickname: true,
        profilePic: true,
        country: true,
        publicationsCreated: true,
      },
    });
    return users.map((u) => ({
      nickname: u.nickname,
      profilePic: u.profilePic,
      country: u.country,
      count: u.publicationsCreated,
    }));
  }

  async creatorsNational(country: string, limit = 50) {
    const users = await this.prisma.user.findMany({
      where: { country, publicationsCreated: { gt: 0 } },
      orderBy: { publicationsCreated: 'desc' },
      take: limit,
      select: {
        nickname: true,
        profilePic: true,
        country: true,
        publicationsCreated: true,
      },
    });
    return users.map((u) => ({
      nickname: u.nickname,
      profilePic: u.profilePic,
      country: u.country,
      count: u.publicationsCreated,
    }));
  }

  private async monthlyTop(
    field: 'pixels' | 'creations',
    period: string,
    country: string | null,
    limit: number,
  ) {
    const rows = await this.prisma.monthlyScore.findMany({
      where: {
        period,
        ...(field === 'pixels'
          ? { pixels: { gt: 0 } }
          : { creations: { gt: 0 } }),
        user: { isAdmin: false, ...(country ? { country } : {}) },
      },
      orderBy: field === 'pixels' ? { pixels: 'desc' } : { creations: 'desc' },
      take: limit,
      include: {
        user: { select: { nickname: true, profilePic: true, country: true } },
      },
    });
    return rows.map((r) => ({
      nickname: r.user.nickname,
      profilePic: r.user.profilePic,
      country: r.user.country,
      count: field === 'pixels' ? r.pixels : r.creations,
    }));
  }

  async pixelsMonthlyGlobal(limit = 50) {
    return this.monthlyTop('pixels', currentPeriod(), null, limit);
  }
  async pixelsMonthlyNational(country: string, limit = 50) {
    return this.monthlyTop('pixels', currentPeriod(), country, limit);
  }
  async creatorsMonthlyGlobal(limit = 50) {
    return this.monthlyTop('creations', currentPeriod(), null, limit);
  }
  async creatorsMonthlyNational(country: string, limit = 50) {
    return this.monthlyTop('creations', currentPeriod(), country, limit);
  }

  // Periodo actual + cuándo cierra (para la cuenta regresiva del frontend)
  monthlyInfo() {
    const now = new Date();
    const endsAt = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );
    return { period: currentPeriod(now), endsAt };
  }

  // ----- Cierre mensual y premios -----

  private async monthlyRowsForClose(
    metric: 'pixels' | 'creations',
    period: string,
    country: string | null,
    limit: number,
  ) {
    const rows = await this.prisma.monthlyScore.findMany({
      where: {
        period,
        ...(metric === 'pixels'
          ? { pixels: { gt: 0 } }
          : { creations: { gt: 0 } }),
        user: { isAdmin: false, ...(country ? { country } : {}) },
      },
      orderBy:
        metric === 'pixels'
          ? [{ pixels: 'desc' }, { userId: 'asc' }]
          : [{ creations: 'desc' }, { userId: 'asc' }],
      take: limit,
      select: { userId: true, pixels: true, creations: true },
    });
    return rows.map((r) => ({
      userId: r.userId,
      score: metric === 'pixels' ? r.pixels : r.creations,
    }));
  }

  private async countriesWithScores(
    metric: 'pixels' | 'creations',
    period: string,
  ): Promise<string[]> {
    const rows = await this.prisma.monthlyScore.findMany({
      where: {
        period,
        ...(metric === 'pixels'
          ? { pixels: { gt: 0 } }
          : { creations: { gt: 0 } }),
        user: { isAdmin: false, country: { not: null } },
      },
      select: { user: { select: { country: true } } },
    });
    const set = new Set<string>();
    for (const r of rows) if (r.user.country) set.add(r.user.country);
    return [...set];
  }

  private async grantMedal(
    userId: number,
    tier: 'gold' | 'silver' | 'bronze',
    metric: 'pixels' | 'creations',
    period: string,
  ) {
    const TIERS = {
      gold: {
        name: 'Oro',
        color: '#FFD700',
        rarity: 'LEGENDARY' as const,
        pos: 1,
      },
      silver: {
        name: 'Plata',
        color: '#C0C0C0',
        rarity: 'EPIC' as const,
        pos: 2,
      },
      bronze: {
        name: 'Bronce',
        color: '#CD7F32',
        rarity: 'RARE' as const,
        pos: 3,
      },
    };
    const t = TIERS[tier];
    const metricName = metric === 'pixels' ? 'Píxeles' : 'Creadores';
    const key = `medal_${tier}_${metric}_${period}`;

    const cosmetic = await this.prisma.cosmetic.upsert({
      where: { key },
      update: {},
      create: {
        key,
        type: 'BADGE',
        name: `Medalla de ${t.name} · ${metricName} · ${periodLabelEs(period)}`,
        description: `Top ${t.pos} de ${metricName} en ${periodLabelEs(period)}`,
        source: 'RANKING',
        rarity: t.rarity,
        data: { medal: tier, color: t.color, metric, period },
        active: true,
      },
    });

    await this.prisma.userCosmetic.upsert({
      where: { userId_cosmeticId: { userId, cosmeticId: cosmetic.id } },
      update: {},
      create: { userId, cosmeticId: cosmetic.id },
    });
  }

  private async grantWinner(
    row: { userId: number; score: number },
    info: {
      period: string;
      metric: 'pixels' | 'creations';
      scope: 'global' | 'national';
      country: string | null;
      position: number;
      bits: number;
    },
  ) {
    if (info.bits > 0) {
      await this.prisma.user.update({
        where: { id: row.userId },
        data: { bits: { increment: info.bits } },
      });
    }
    // Medalla de podio (top 3 global), única por mes y métrica
    if (info.scope === 'global' && info.position <= 3) {
      const tier =
        info.position === 1
          ? 'gold'
          : info.position === 2
            ? 'silver'
            : 'bronze';
      await this.grantMedal(row.userId, tier, info.metric, info.period);
    }
    await this.prisma.rankingWinner.create({
      data: {
        period: info.period,
        metric: info.metric,
        scope: info.scope,
        country: info.country,
        position: info.position,
        userId: row.userId,
        score: row.score,
        bitsAwarded: info.bits,
      },
    });
  }

  async closePeriod(period: string) {
    // Idempotencia: si ya hay ganadores de ese periodo, no repartir de nuevo
    const already = await this.prisma.rankingWinner.count({
      where: { period },
    });
    if (already > 0) {
      return { period, skipped: true, reason: 'ya cerrado' };
    }

    const TOP = 10;
    let totalWinners = 0;
    let totalBits = 0;

    for (const metric of ['pixels', 'creations'] as const) {
      // Global
      const global = await this.monthlyRowsForClose(metric, period, null, TOP);
      for (let i = 0; i < global.length; i++) {
        const bits = RANKING_REWARD_BITS.global[i] ?? 0;
        await this.grantWinner(global[i], {
          period,
          metric,
          scope: 'global',
          country: null,
          position: i + 1,
          bits,
        });
        totalWinners++;
        totalBits += bits;
      }

      // Nacional (top 10 de cada país con participantes)
      const countries = await this.countriesWithScores(metric, period);
      for (const country of countries) {
        const national = await this.monthlyRowsForClose(
          metric,
          period,
          country,
          TOP,
        );
        for (let i = 0; i < national.length; i++) {
          const bits = RANKING_REWARD_BITS.national[i] ?? 0;
          await this.grantWinner(national[i], {
            period,
            metric,
            scope: 'national',
            country,
            position: i + 1,
            bits,
          });
          totalWinners++;
          totalBits += bits;
        }
      }
    }

    return { period, skipped: false, totalWinners, totalBits };
  }

  async adminClose(adminUserId: number, period: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });
    if (!admin?.isAdmin) throw new ForbiddenException('Solo admin');
    return this.closePeriod(period);
  }

  // Cron: día 1 de cada mes a las 00:05 UTC, cierra el mes recién terminado
  @Cron('5 0 1 * *', { timeZone: 'UTC' })
  async monthlyCloseCron() {
    await this.closePeriod(previousPeriod());
  }

  // ----- Salón de la fama (para el frontend) -----

  async closedPeriods(): Promise<string[]> {
    const rows = await this.prisma.rankingWinner.findMany({
      distinct: ['period'],
      select: { period: true },
      orderBy: { period: 'desc' },
    });
    return rows.map((r) => r.period);
  }

  async winnersForPeriod(period: string) {
    const rows = await this.prisma.rankingWinner.findMany({
      where: { period },
      orderBy: [{ metric: 'asc' }, { scope: 'asc' }, { position: 'asc' }],
      include: {
        user: { select: { nickname: true, profilePic: true, country: true } },
      },
    });
    return rows.map((r) => ({
      metric: r.metric,
      scope: r.scope,
      country: r.country,
      position: r.position,
      score: r.score,
      bitsAwarded: r.bitsAwarded,
      nickname: r.user.nickname,
      profilePic: r.user.profilePic,
      userCountry: r.user.country,
    }));
  }

  async pendingForUser(userId: number) {
    const rows = await this.prisma.rankingWinner.findMany({
      where: { userId, seen: false },
      orderBy: [{ period: 'desc' }, { position: 'asc' }],
    });
    const byPeriod = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byPeriod.get(r.period) ?? [];
      arr.push(r);
      byPeriod.set(r.period, arr);
    }
    return [...byPeriod.entries()].map(([period, list]) => {
      const best = list.reduce((a, b) => {
        if (b.position !== a.position) return b.position < a.position ? b : a;
        if (a.scope === 'global' && b.scope !== 'global') return a;
        if (b.scope === 'global' && a.scope !== 'global') return b;
        return b.bitsAwarded > a.bitsAwarded ? b : a;
      });
      const totalBits = list.reduce((s, r) => s + r.bitsAwarded, 0);
      return {
        period,
        bestPosition: best.position,
        bestScope: best.scope,
        bestMetric: best.metric,
        totalBits,
      };
    });
  }

  async markPendingSeen(userId: number, periods: string[]) {
    if (!periods.length) return { updated: 0 };
    const res = await this.prisma.rankingWinner.updateMany({
      where: { userId, period: { in: periods }, seen: false },
      data: { seen: true },
    });
    return { updated: res.count };
  }
}
