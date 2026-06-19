import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, PrivateSpaceAccess } from '@prisma/client';
import {
  PRIVATE_SPACE_CONFIG,
  computeMonthlyBits,
} from './private-spaces.config';
import { NotificationService } from '../notifications/notification.service'; // ajusta la ruta si tu carpeta es 'notification'

const GRACE_MS = PRIVATE_SPACE_CONFIG.GRACE_HOURS * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const CLAIM_MS = PRIVATE_SPACE_CONFIG.CLAIM_HOURS * 60 * 60 * 1000;

@Injectable()
export class PrivateSpacesService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

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
      throw new BadRequestException({
        message: `Ningún lado puede ser menor a ${MIN_SIDE} píxeles`,
        code: 'SPACE_SIDE_TOO_SMALL',
        params: { min: MIN_SIDE },
      });
    }
    if (pixels < MIN_PIXELS) {
      throw new BadRequestException({
        message: `El espacio debe tener al menos ${MIN_PIXELS} píxeles de área`,
        code: 'SPACE_AREA_TOO_SMALL',
        params: { min: MIN_PIXELS },
      });
    }
    if (width > MAX_SIDE || height > MAX_SIDE) {
      throw new BadRequestException({
        message: `Ningún lado puede exceder ${MAX_SIDE} píxeles`,
        code: 'SPACE_SIDE_TOO_BIG',
        params: { max: MAX_SIDE },
      });
    }
    return pixels;
  }

  // Un espacio sigue "vivo" hasta GRACE_HOURS después de vencer.
  private activeWhere(now: Date): Prisma.PrivateSpaceWhereInput {
    return { expiresAt: { gt: new Date(now.getTime() - GRACE_MS) } };
  }

  quote(x1: number, y1: number, x2: number, y2: number) {
    const { minX, maxX, minY, maxY } = this.normalize(x1, y1, x2, y2);
    const pixels = this.validateSize(minX, maxX, minY, maxY);
    return { pixels, monthlyBits: computeMonthlyBits(minX, maxX, minY, maxY) };
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
    const monthlyBits = computeMonthlyBits(minX, maxX, minY, maxY);

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
        throw new BadRequestException({
          message: `No se encontraron estos usuarios: ${missing.join(', ')}`,
          code: 'SPACE_USERS_NOT_FOUND',
          params: { users: missing.join(', ') },
        });
      }
      memberIds = users.map((u) => u.id).filter((id) => id !== userId);
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740012)`;
        const now = new Date();
        const liveThreshold = new Date(now.getTime() - GRACE_MS);

        const myActive = await tx.privateSpace.findMany({
          where: { ownerId: userId, expiresAt: { gt: liveThreshold } },
          select: { x1: true, y1: true, x2: true, y2: true },
        });
        if (myActive.length >= PRIVATE_SPACE_CONFIG.MAX_SPACES_PER_USER) {
          throw new BadRequestException({
            message: `Ya tienes el máximo de ${PRIVATE_SPACE_CONFIG.MAX_SPACES_PER_USER} espacios activos`,
            code: 'SPACE_MAX_COUNT',
            params: { max: PRIVATE_SPACE_CONFIG.MAX_SPACES_PER_USER },
          });
        }
        const myPixels = myActive.reduce(
          (s, sp) => s + (sp.x2 - sp.x1 + 1) * (sp.y2 - sp.y1 + 1),
          0,
        );
        if (
          myPixels + pixels >
          PRIVATE_SPACE_CONFIG.MAX_TOTAL_PIXELS_PER_USER
        ) {
          throw new BadRequestException({
            message: `Superarías tu tope de ${PRIVATE_SPACE_CONFIG.MAX_TOTAL_PIXELS_PER_USER} píxeles privados`,
            code: 'SPACE_MAX_PIXELS',
            params: { max: PRIVATE_SPACE_CONFIG.MAX_TOTAL_PIXELS_PER_USER },
          });
        }

        const myClaim = await tx.privateSpaceWaitlist.findFirst({
          where: { userId, claimExpiresAt: { gt: now } },
        });

        if (myClaim) {
          if (pixels > myClaim.desiredPixels) {
            throw new BadRequestException({
              message: 'El área supera lo que apartaste en la lista de espera.',
              code: 'CLAIM_TOO_BIG',
              params: { reserved: myClaim.desiredPixels },
            });
          }
          // Su reserva ya está apartada; no pasa por el chequeo del tope general.
        } else {
          // Anti-sniping: si hay alguien en la cola, no se permiten compras directas.
          const queueCount = await tx.privateSpaceWaitlist.count();
          if (queueCount > 0) {
            throw new BadRequestException({
              message:
                'El espacio privado está al tope. Puedes anotarte en la lista de espera.',
              code: 'SPACE_CAP_REACHED',
              params: { cap: PRIVATE_SPACE_CONFIG.GLOBAL_PIXEL_CAP },
            });
          }
          const active = await tx.privateSpace.findMany({
            where: { expiresAt: { gt: liveThreshold } },
            select: { x1: true, y1: true, x2: true, y2: true },
          });
          const usedPixels = active.reduce(
            (s, sp) => s + (sp.x2 - sp.x1 + 1) * (sp.y2 - sp.y1 + 1),
            0,
          );
          if (usedPixels + pixels > PRIVATE_SPACE_CONFIG.GLOBAL_PIXEL_CAP) {
            throw new BadRequestException({
              message:
                'El espacio privado está al tope. Puedes anotarte en la lista de espera.',
              code: 'SPACE_CAP_REACHED',
              params: {
                cap: PRIVATE_SPACE_CONFIG.GLOBAL_PIXEL_CAP,
                used: usedPixels,
                requested: pixels,
              },
            });
          }
        }

        const overlap = await tx.privateSpace.findFirst({
          where: {
            AND: [
              {
                x1: { lte: maxX },
                x2: { gte: minX },
                y1: { lte: maxY },
                y2: { gte: minY },
              },
              { expiresAt: { gt: liveThreshold } },
            ],
          },
        });
        if (overlap) {
          throw new BadRequestException({
            message: 'El área se traslapa con otro espacio privado existente',
            code: 'SPACE_OVERLAP',
          });
        }

        const foreign = await tx.pixel.findFirst({
          where: {
            x: { gte: minX, lte: maxX },
            y: { gte: minY, lte: maxY },
            AND: [{ userId: { not: null } }, { userId: { not: userId } }],
          },
        });
        if (foreign) {
          throw new BadRequestException({
            message:
              'El área contiene píxeles de otro usuario. Solo puedes comprar zonas vacías o con tus propios píxeles.',
            code: 'SPACE_HAS_FOREIGN',
          });
        }

        const debit = await tx.user.updateMany({
          where: { id: userId, bits: { gte: monthlyBits } },
          data: { bits: { decrement: monthlyBits } },
        });
        if (debit.count === 0) {
          throw new BadRequestException({
            message: 'No tienes Bits suficientes para rentar este espacio.',
            code: 'INSUFFICIENT_BITS',
            params: { required: monthlyBits },
          });
        }

        const space = await tx.privateSpace.create({
          data: {
            ownerId: userId,
            name: data.name || null,
            x1: minX,
            y1: minY,
            x2: maxX,
            y2: maxY,
            accessMode: data.accessMode as PrivateSpaceAccess,
            monthlyBits,
            expiresAt: new Date(Date.now() + MONTH_MS),
            members: memberIds.length
              ? { create: memberIds.map((uid) => ({ userId: uid })) }
              : undefined,
          },
        });

        if (myClaim) {
          await tx.privateSpaceWaitlist.delete({ where: { id: myClaim.id } }); // sale de la cola
        }

        const promoted = await this.promoteWithinTx(tx, now);
        return { space, promoted };
      },
      { maxWait: 10000, timeout: 20000 },
    );

    await this.notifyPromoted(result.promoted);
    return { success: true, space: result.space };
  }

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
    return spaces.map((s) => {
      const graceEndsAt = new Date(s.expiresAt.getTime() + GRACE_MS);
      const status =
        s.expiresAt > now ? 'active' : now < graceEndsAt ? 'grace' : 'expired';
      return {
        id: s.id,
        name: s.name,
        x1: s.x1,
        y1: s.y1,
        x2: s.x2,
        y2: s.y2,
        accessMode: s.accessMode,
        monthlyBits: s.monthlyBits,
        expiresAt: s.expiresAt,
        status,
        active: status !== 'expired',
        graceEndsAt: status === 'grace' ? graceEndsAt : null,
        pixels: (s.x2 - s.x1 + 1) * (s.y2 - s.y1 + 1),
        members: s.members.map((m) => m.user.nickname),
      };
    });
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
    if (!space)
      throw new NotFoundException({
        message: 'Espacio no encontrado',
        code: 'SPACE_NOT_FOUND',
      });
    if (space.ownerId !== userId)
      throw new ForbiddenException({
        message: 'No es tu espacio',
        code: 'SPACE_NOT_YOURS',
      });

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
    if (!space)
      throw new NotFoundException({
        message: 'Espacio no encontrado',
        code: 'SPACE_NOT_FOUND',
      });
    if (space.ownerId !== userId)
      throw new ForbiddenException({
        message: 'No es tu espacio',
        code: 'SPACE_NOT_YOURS',
      });

    const promoted = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740012)`;
        await tx.privateSpace.delete({ where: { id: spaceId } });
        return this.promoteWithinTx(tx, new Date());
      },
      { maxWait: 10000, timeout: 20000 },
    );
    await this.notifyPromoted(promoted);
    return { success: true };
  }

  // Corre DENTRO de una transacción (con el advisory lock ya tomado): limpia turnos
  // vencidos, promueve en FIFO a los que quepan y devuelve a quién avisar.
  private async promoteWithinTx(
    tx: Prisma.TransactionClient,
    now: Date,
  ): Promise<{ email: string | null }[]> {
    // Turnos vencidos sin reclamar: salen de la cola
    await tx.privateSpaceWaitlist.deleteMany({
      where: { claimExpiresAt: { lt: now } },
    });

    // Presupuesto comprometido = espacios vivos (incl. gracia) + turnos activos
    const liveThreshold = new Date(now.getTime() - GRACE_MS);
    const liveSpaces = await tx.privateSpace.findMany({
      where: { expiresAt: { gt: liveThreshold } },
      select: { x1: true, y1: true, x2: true, y2: true },
    });
    let committed = liveSpaces.reduce(
      (s, sp) => s + (sp.x2 - sp.x1 + 1) * (sp.y2 - sp.y1 + 1),
      0,
    );
    const activeClaims = await tx.privateSpaceWaitlist.findMany({
      where: { claimExpiresAt: { gt: now } },
      select: { desiredPixels: true },
    });
    committed += activeClaims.reduce((s, c) => s + c.desiredPixels, 0);

    let headroom = PRIVATE_SPACE_CONFIG.GLOBAL_PIXEL_CAP - committed;
    if (headroom <= 0) return [];

    // FIFO: promueve a los que quepan; los que no caben conservan su lugar
    const waiting = await tx.privateSpaceWaitlist.findMany({
      where: { claimExpiresAt: null },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { email: true } } },
    });
    const promoted: { email: string | null }[] = [];
    for (const w of waiting) {
      if (w.desiredPixels <= headroom) {
        await tx.privateSpaceWaitlist.update({
          where: { id: w.id },
          data: {
            notifiedAt: now,
            claimExpiresAt: new Date(now.getTime() + CLAIM_MS),
          },
        });
        promoted.push({ email: w.user.email });
        headroom -= w.desiredPixels;
      }
    }
    return promoted;
  }

  private async notifyPromoted(promoted: { email: string | null }[]) {
    for (const p of promoted) {
      if (p.email)
        await this.notificationService.sendWaitlistTurnNotice(p.email);
    }
  }

  async joinWaitlist(
    userId: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ) {
    const { minX, maxX, minY, maxY } = this.normalize(x1, y1, x2, y2);
    const desiredPixels = this.validateSize(minX, maxX, minY, maxY);

    const promoted = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740012)`;
        const now = new Date();
        const existing = await tx.privateSpaceWaitlist.findUnique({
          where: { userId },
        });
        if (existing?.claimExpiresAt && existing.claimExpiresAt > now)
          return []; // ya tiene turno
        await tx.privateSpaceWaitlist.upsert({
          where: { userId },
          update: { desiredPixels, notifiedAt: null, claimExpiresAt: null },
          create: { userId, desiredPixels },
        });
        return this.promoteWithinTx(tx, now);
      },
      { maxWait: 10000, timeout: 20000 },
    );
    await this.notifyPromoted(promoted);
    return this.getMyWaitlist(userId);
  }

  async getMyWaitlist(userId: number) {
    const now = new Date();
    const mine = await this.prisma.privateSpaceWaitlist.findUnique({
      where: { userId },
    });
    if (!mine) return { inQueue: false };
    const claimActive =
      mine.claimExpiresAt != null && mine.claimExpiresAt > now;
    const ahead = await this.prisma.privateSpaceWaitlist.count({
      where: { claimExpiresAt: null, createdAt: { lt: mine.createdAt } },
    });
    return {
      inQueue: true,
      desiredPixels: mine.desiredPixels,
      claimActive,
      claimExpiresAt: claimActive ? mine.claimExpiresAt : null,
      position: claimActive ? 0 : ahead + 1,
    };
  }

  async leaveWaitlist(userId: number) {
    const promoted = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740012)`;
        const existing = await tx.privateSpaceWaitlist.findUnique({
          where: { userId },
        });
        if (!existing) return [];
        await tx.privateSpaceWaitlist.delete({ where: { userId } });
        return this.promoteWithinTx(tx, new Date()); // libera su reserva si tenía turno
      },
      { maxWait: 10000, timeout: 20000 },
    );
    await this.notifyPromoted(promoted);
    return { success: true };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async processRenewals() {
    const now = new Date();
    const due = await this.prisma.privateSpace.findMany({
      where: { expiresAt: { lte: now } },
      include: { owner: { select: { email: true } } },
    });

    for (const space of due) {
      const debit = await this.prisma.user.updateMany({
        where: { id: space.ownerId, bits: { gte: space.monthlyBits } },
        data: { bits: { decrement: space.monthlyBits } },
      });
      if (debit.count > 0) {
        await this.prisma.privateSpace.update({
          where: { id: space.id },
          data: {
            expiresAt: new Date(space.expiresAt.getTime() + MONTH_MS),
            graceNotifiedAt: null,
          },
        });
        continue;
      }
      const graceEndsAt = new Date(space.expiresAt.getTime() + GRACE_MS);
      if (now >= graceEndsAt) {
        await this.prisma.privateSpace.delete({ where: { id: space.id } });
        if (space.owner.email)
          await this.notificationService.sendSpaceReleasedNotice(
            space.owner.email,
            space.name,
          );
      } else if (!space.graceNotifiedAt) {
        await this.prisma.privateSpace.update({
          where: { id: space.id },
          data: { graceNotifiedAt: now },
        });
        if (space.owner.email)
          await this.notificationService.sendSpaceGraceNotice(
            space.owner.email,
            space.name,
            graceEndsAt,
          );
      }
    }

    // Asigna el headroom liberado a la lista de espera
    const promoted = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(740012)`;
        return this.promoteWithinTx(tx, new Date());
      },
      { maxWait: 10000, timeout: 20000 },
    );
    await this.notifyPromoted(promoted);
  }
}
