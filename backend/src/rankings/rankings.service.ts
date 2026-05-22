import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    const grouped = await this.prisma.pixel.groupBy({
      by: ['userId'],
      where: { userId: { not: null } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    });
    return this.hydrate(
      grouped.map((g) => ({ userId: g.userId, count: g._count.userId })),
    );
  }

  async pixelsNational(country: string, limit = 50) {
    const usersInCountry = await this.prisma.user.findMany({
      where: { country },
      select: { id: true },
    });
    const ids = usersInCountry.map((u) => u.id);
    if (ids.length === 0) return [];

    const grouped = await this.prisma.pixel.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    });
    return this.hydrate(
      grouped.map((g) => ({ userId: g.userId, count: g._count.userId })),
    );
  }

  async creatorsGlobal(limit = 50) {
    const grouped = await this.prisma.publication.groupBy({
      by: ['userId'],
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    });
    return this.hydrate(
      grouped.map((g) => ({ userId: g.userId, count: g._count.userId })),
    );
  }

  async creatorsNational(country: string, limit = 50) {
    const usersInCountry = await this.prisma.user.findMany({
      where: { country },
      select: { id: true },
    });
    const ids = usersInCountry.map((u) => u.id);
    if (ids.length === 0) return [];

    const grouped = await this.prisma.publication.groupBy({
      by: ['userId'],
      where: { userId: { in: ids } },
      _count: { userId: true },
      orderBy: { _count: { userId: 'desc' } },
      take: limit,
    });
    return this.hydrate(
      grouped.map((g) => ({ userId: g.userId, count: g._count.userId })),
    );
  }
}
