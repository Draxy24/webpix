import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PrivateSpaceAccess, PurchaseType } from '@prisma/client';
import {
  PRIVATE_SPACE_CONFIG,
  computePriceCents,
} from './private-spaces.config';

@Injectable()
export class PrivateSpacesService {
  constructor(private prisma: PrismaService) {}

  private normalize(x1: number, y1: number, x2: number, y2: number) {
    return {
      minX: Math.min(x1, x2),
      maxX: Math.max(x1, x2),
      minY: Math.min(y1, y2),
      maxY: Math.max(y1, y2),
    };
  }

  private validateSize(minX: number, maxX: number, minY: number, maxY: number) {
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const pixels = width * height;
    const { MIN_SIDE, MIN_PIXELS, MAX_SIDE } = PRIVATE_SPACE_CONFIG;
    if (width < MIN_SIDE || height < MIN_SIDE) {
      throw new BadRequestException(
        `Ningún lado puede ser menor a ${MIN_SIDE} píxeles`,
      );
    }
    if (pixels < MIN_PIXELS) {
      throw new BadRequestException(
        `El espacio debe tener al menos ${MIN_PIXELS} píxeles de área`,
      );
    }
    if (width > MAX_SIDE || height > MAX_SIDE) {
      throw new BadRequestException(
        `Ningún lado puede exceder ${MAX_SIDE} píxeles`,
      );
    }
    return pixels;
  }

  private activeWhere(now: Date): Prisma.PrivateSpaceWhereInput {
    return {
      OR: [
        { purchaseType: PurchaseType.PERMANENT },
        { expiresAt: { gt: now } },
      ],
    };
  }

  quote(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    purchaseType: 'MONTHLY' | 'PERMANENT',
  ) {
    const { minX, maxX, minY, maxY } = this.normalize(x1, y1, x2, y2);
    const pixels = this.validateSize(minX, maxX, minY, maxY);
    return {
      pixels,
      purchaseType,
      priceCents: computePriceCents(pixels, purchaseType),
    };
  }

  async purchase(
    userId: number,
    data: {
      name?: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      accessMode: 'OWNER_ONLY' | 'FRIENDS' | 'SPECIFIC';
      purchaseType: 'MONTHLY' | 'PERMANENT';
      memberNicknames?: string[];
    },
  ) {
    const { minX, maxX, minY, maxY } = this.normalize(
      data.x1,
      data.y1,
      data.x2,
      data.y2,
    );
    const pixels = this.validateSize(minX, maxX, minY, maxY);
    const now = new Date();

    // Límites por usuario
    const myActive = await this.prisma.privateSpace.findMany({
      where: { ownerId: userId, ...this.activeWhere(now) },
    });
    if (myActive.length >= PRIVATE_SPACE_CONFIG.MAX_SPACES_PER_USER) {
      throw new BadRequestException(
        `Ya tienes el máximo de ${PRIVATE_SPACE_CONFIG.MAX_SPACES_PER_USER} espacios activos`,
      );
    }
    const myPixels = myActive.reduce(
      (s, sp) => s + (sp.x2 - sp.x1 + 1) * (sp.y2 - sp.y1 + 1),
      0,
    );
    if (myPixels + pixels > PRIVATE_SPACE_CONFIG.MAX_TOTAL_PIXELS_PER_USER) {
      throw new BadRequestException(
        `Superarías tu tope de ${PRIVATE_SPACE_CONFIG.MAX_TOTAL_PIXELS_PER_USER} píxeles privados`,
      );
    }

    // Sin traslape con otro espacio activo
    const overlap = await this.prisma.privateSpace.findFirst({
      where: {
        AND: [
          {
            x1: { lte: maxX },
            x2: { gte: minX },
            y1: { lte: maxY },
            y2: { gte: minY },
          },
          this.activeWhere(now),
        ],
      },
    });
    if (overlap) {
      throw new BadRequestException(
        'El área se traslapa con otro espacio privado existente',
      );
    }

    // Sin píxeles de otro usuario (vacío o tuyo está bien)
    const foreign = await this.prisma.pixel.findFirst({
      where: {
        x: { gte: minX, lte: maxX },
        y: { gte: minY, lte: maxY },
        AND: [{ userId: { not: null } }, { userId: { not: userId } }],
      },
    });
    if (foreign) {
      throw new BadRequestException(
        'El área contiene píxeles de otro usuario. Solo puedes comprar zonas vacías o con tus propios píxeles.',
      );
    }

    // Resolver miembros (solo modo específico)
    let memberIds: number[] = [];
    if (data.accessMode === 'SPECIFIC' && data.memberNicknames?.length) {
      const unique = [...new Set(data.memberNicknames)].filter((n) => n);
      const users = await this.prisma.user.findMany({
        where: { nickname: { in: unique } },
        select: { id: true, nickname: true },
      });
      const found = new Set(users.map((u) => u.nickname));
      const missing = unique.filter((n) => !found.has(n));
      if (missing.length) {
        throw new BadRequestException(
          `No se encontraron estos usuarios: ${missing.join(', ')}`,
        );
      }
      memberIds = users.map((u) => u.id).filter((id) => id !== userId);
    }

    const priceCents = computePriceCents(pixels, data.purchaseType);
    const expiresAt =
      data.purchaseType === 'MONTHLY'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null;

    // TODO: cuando integremos Stripe, el cobro real va AQUÍ antes de crear.
    // Por ahora es compra simulada (sin cobro).

    const space = await this.prisma.privateSpace.create({
      data: {
        ownerId: userId,
        name: data.name || null,
        x1: minX,
        y1: minY,
        x2: maxX,
        y2: maxY,
        accessMode: data.accessMode as PrivateSpaceAccess,
        purchaseType: data.purchaseType as PurchaseType,
        pricePaidCents: priceCents,
        expiresAt,
        members: memberIds.length
          ? { create: memberIds.map((uid) => ({ userId: uid })) }
          : undefined,
      },
    });

    return { success: true, space };
  }

  // Usado por PixelService (paso siguiente) para bloquear pintado/borrado
  async checkPaintAccess(
    userId: number | null,
    x: number,
    y: number,
  ): Promise<{ inSpace: boolean; allowed: boolean }> {
    const now = new Date();
    const space = await this.prisma.privateSpace.findFirst({
      where: {
        AND: [
          { x1: { lte: x }, x2: { gte: x }, y1: { lte: y }, y2: { gte: y } },
          this.activeWhere(now),
        ],
      },
      include: { members: { select: { userId: true } } },
    });

    if (!space) return { inSpace: false, allowed: false };
    if (userId == null) return { inSpace: true, allowed: false };
    if (space.ownerId === userId) return { inSpace: true, allowed: true };
    if (space.accessMode === 'OWNER_ONLY')
      return { inSpace: true, allowed: false };
    if (space.accessMode === 'SPECIFIC') {
      return {
        inSpace: true,
        allowed: space.members.some((m) => m.userId === userId),
      };
    }
    // FRIENDS
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: space.ownerId, receiverId: userId },
          { senderId: userId, receiverId: space.ownerId },
        ],
      },
    });
    return { inSpace: true, allowed: !!friendship };
  }

  // ¿El área toca algún espacio privado activo? (para el borrado en área)
  async overlapsActiveSpace(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): Promise<boolean> {
    const now = new Date();
    const hit = await this.prisma.privateSpace.findFirst({
      where: {
        AND: [
          {
            x1: { lte: maxX },
            x2: { gte: minX },
            y1: { lte: maxY },
            y2: { gte: minY },
          },
          this.activeWhere(now),
        ],
      },
    });
    return !!hit;
  }

  async getActiveSpaces() {
    const now = new Date();
    const spaces = await this.prisma.privateSpace.findMany({
      where: this.activeWhere(now),
      include: { owner: { select: { nickname: true } } },
    });
    return spaces.map((s) => ({
      id: s.id,
      name: s.name,
      x1: s.x1,
      y1: s.y1,
      x2: s.x2,
      y2: s.y2,
      accessMode: s.accessMode,
      owner: s.owner.nickname,
    }));
  }

  async listMine(userId: number) {
    const now = new Date();
    const spaces = await this.prisma.privateSpace.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        members: { include: { user: { select: { nickname: true } } } },
      },
    });
    return spaces.map((s) => ({
      id: s.id,
      name: s.name,
      x1: s.x1,
      y1: s.y1,
      x2: s.x2,
      y2: s.y2,
      accessMode: s.accessMode,
      purchaseType: s.purchaseType,
      expiresAt: s.expiresAt,
      active:
        s.purchaseType === 'PERMANENT' ||
        (s.expiresAt != null && s.expiresAt > now),
      pixels: (s.x2 - s.x1 + 1) * (s.y2 - s.y1 + 1),
      members: s.members.map((m) => m.user.nickname),
    }));
  }

  async updateAccess(
    userId: number,
    spaceId: number,
    data: {
      accessMode?: 'OWNER_ONLY' | 'FRIENDS' | 'SPECIFIC';
      addNicknames?: string[];
      removeNicknames?: string[];
    },
  ) {
    const space = await this.prisma.privateSpace.findUnique({
      where: { id: spaceId },
    });
    if (!space) throw new NotFoundException('Espacio no encontrado');
    if (space.ownerId !== userId)
      throw new ForbiddenException('No es tu espacio');

    if (data.accessMode) {
      await this.prisma.privateSpace.update({
        where: { id: spaceId },
        data: { accessMode: data.accessMode as PrivateSpaceAccess },
      });
    }
    if (data.addNicknames?.length) {
      const users = await this.prisma.user.findMany({
        where: { nickname: { in: data.addNicknames } },
        select: { id: true },
      });
      for (const u of users) {
        if (u.id === userId) continue;
        await this.prisma.privateSpaceMember.upsert({
          where: { spaceId_userId: { spaceId, userId: u.id } },
          update: {},
          create: { spaceId, userId: u.id },
        });
      }
    }
    if (data.removeNicknames?.length) {
      const users = await this.prisma.user.findMany({
        where: { nickname: { in: data.removeNicknames } },
        select: { id: true },
      });
      await this.prisma.privateSpaceMember.deleteMany({
        where: { spaceId, userId: { in: users.map((u) => u.id) } },
      });
    }
    return { success: true };
  }

  async release(userId: number, spaceId: number) {
    const space = await this.prisma.privateSpace.findUnique({
      where: { id: spaceId },
    });
    if (!space) throw new NotFoundException('Espacio no encontrado');
    if (space.ownerId !== userId)
      throw new ForbiddenException('No es tu espacio');
    await this.prisma.privateSpace.delete({ where: { id: spaceId } });
    return { success: true };
  }
}
