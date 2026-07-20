import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CURRENCY_NAME,
  CURRENCY_NAME_PLURAL,
  PROGRESSION_CONFIG,
  STARTER_COSMETICS,
  LAUNCH_REWARD,
  levelInfo,
} from './rewards.config';

@Injectable()
export class RewardsService {
  constructor(private prisma: PrismaService) {}

  async getProgression(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const info = levelInfo(user.xp);
    const equipped = await this.prisma.userCosmetic.findMany({
      where: { userId, equipped: true },
      include: { cosmetic: true },
    });
    const title = equipped.find((e) => e.cosmetic.type === 'TITLE')?.cosmetic;
    const badge = equipped.find((e) => e.cosmetic.type === 'BADGE')?.cosmetic;
    const frame = equipped.find((e) => e.cosmetic.type === 'FRAME')?.cosmetic;
    const background = equipped.find(
      (e) => e.cosmetic.type === 'BACKGROUND',
    )?.cosmetic;

    return {
      bits: user.bits,
      xp: user.xp,
      level: info.level,
      xpIntoLevel: info.xpIntoLevel,
      xpForNext: info.xpForNext,
      currencyName: CURRENCY_NAME,
      currencyNamePlural: CURRENCY_NAME_PLURAL,
      equippedTitle: title
        ? { id: title.id, key: title.key, name: title.name }
        : null,
      equippedBadge: badge
        ? { id: badge.id, key: badge.key, name: badge.name, data: badge.data }
        : null,
      equippedFrame: frame
        ? { id: frame.id, key: frame.key, name: frame.name, data: frame.data }
        : null,
      equippedBackground: background
        ? {
            id: background.id,
            key: background.key,
            name: background.name,
            data: background.data,
          }
        : null,
    };
  }

  async listMyCosmetics(userId: number) {
    const owned = await this.prisma.userCosmetic.findMany({
      where: { userId },
      include: { cosmetic: true },
      orderBy: { unlockedAt: 'desc' },
    });
    return owned.map((uc) => ({
      cosmeticId: uc.cosmeticId,
      key: uc.cosmetic.key,
      type: uc.cosmetic.type,
      name: uc.cosmetic.name,
      description: uc.cosmetic.description,
      data: uc.cosmetic.data,
      equipped: uc.equipped,
    }));
  }

  async equip(userId: number, cosmeticId: number) {
    const owned = await this.prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId } },
      include: { cosmetic: true },
    });
    if (!owned) throw new BadRequestException('No tienes este cosmético');

    const type = owned.cosmetic.type;
    const equipped = await this.prisma.userCosmetic.findMany({
      where: { userId, equipped: true },
      include: { cosmetic: true },
    });
    const toUnequip = equipped
      .filter((uc) => uc.cosmetic.type === type)
      .map((uc) => uc.id);
    if (toUnequip.length) {
      await this.prisma.userCosmetic.updateMany({
        where: { id: { in: toUnequip } },
        data: { equipped: false },
      });
    }
    await this.prisma.userCosmetic.update({
      where: { id: owned.id },
      data: { equipped: true },
    });
    return { success: true };
  }

  async unequip(userId: number, cosmeticId: number) {
    const owned = await this.prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId } },
    });
    if (!owned) throw new BadRequestException('No tienes este cosmético');
    await this.prisma.userCosmetic.update({
      where: { id: owned.id },
      data: { equipped: false },
    });
    return { success: true };
  }

  // ---- Plomería para otorgar recompensas (la usarán logros, tareas, rankings, eventos) ----

  async grantBits(userId: number, amount: number) {
    if (amount <= 0) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { bits: { increment: amount } },
    });
  }

  async addXp(userId: number, amount: number) {
    if (amount <= 0) return { leveledUp: false, level: null, bitsAwarded: 0 };
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { leveledUp: false, level: null, bitsAwarded: 0 };

    const newXp = user.xp + amount;
    const info = levelInfo(newXp);
    const levelsGained = Math.max(info.level - user.level, 0);
    const bitsAwarded = levelsGained * PROGRESSION_CONFIG.LEVEL_UP_BITS;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        xp: newXp,
        level: info.level,
        ...(bitsAwarded > 0 ? { bits: { increment: bitsAwarded } } : {}),
      },
    });
    return { leveledUp: levelsGained > 0, level: info.level, bitsAwarded };
  }

  async grantCosmetic(userId: number, cosmeticKey: string) {
    const cosmetic = await this.prisma.cosmetic.findUnique({
      where: { key: cosmeticKey },
    });
    if (!cosmetic)
      throw new NotFoundException(`Cosmético "${cosmeticKey}" no existe`);

    const existing = await this.prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId: cosmetic.id } },
    });
    if (existing) return { granted: false };

    await this.prisma.userCosmetic.create({
      data: { userId, cosmeticId: cosmetic.id },
    });
    return { granted: true };
  }

  private async maybeGrantLaunchReward(userId: number) {
    const cosmetic = await this.prisma.cosmetic.findUnique({
      where: { key: LAUNCH_REWARD.cosmeticKey },
    });
    if (!cosmetic) return; // catálogo aún no sembrado: no pasa nada

    // ¿ya lo tiene? nada que hacer (y así no contamos de más)
    const already = await this.prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId: cosmetic.id } },
    });
    if (already) return;

    // ¿queda cupo? cuenta cuántos ya tienen el OG
    const recipients = await this.prisma.userCosmetic.count({
      where: { cosmeticId: cosmetic.id },
    });
    if (recipients >= LAUNCH_REWARD.maxRecipients) return; // hito cerrado

    await this.grantCosmetic(userId, LAUNCH_REWARD.cosmeticKey);
  }

  // ---- Helper temporal de desarrollo: siembra el catálogo y da datos de prueba al admin ----
  async seedAndGrant(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isAdmin) throw new ForbiddenException('Solo administradores');

    for (const c of STARTER_COSMETICS) {
      await this.prisma.cosmetic.upsert({
        where: { key: c.key },
        update: {
          type: c.type,
          name: c.name,
          description: c.description,
          source: c.source,
          priceBits: c.priceBits ?? null,
          data: c.data ?? undefined,
        },
        create: {
          key: c.key,
          type: c.type,
          name: c.name,
          description: c.description,
          source: c.source,
          priceBits: c.priceBits ?? null,
          data: c.data ?? undefined,
        },
      });
    }

    for (const key of ['title_pionero', 'title_artista', 'badge_fundador']) {
      await this.grantCosmetic(userId, key);
    }
    await this.grantBits(userId, 500);
    await this.addXp(userId, 250);

    return { success: true, seeded: STARTER_COSMETICS.length };
  }
}
