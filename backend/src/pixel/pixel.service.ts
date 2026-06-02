import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PixelGateway } from './pixel.gateway';
import { SubscriptionTier } from '@prisma/client';

const TIER_LIMITS: Record<
  SubscriptionTier,
  { pixels: number; cooldownHours: number }
> = {
  FREE: { pixels: 30, cooldownHours: 3 },
  PLUS: { pixels: 60, cooldownHours: 1 },
  PREMIUM: { pixels: Infinity, cooldownHours: 0 },
};

type PaintResult =
  | {
      success: true;
      state: {
        isAdmin: boolean;
        pixelsLeft: number | null;
        cooldownSeconds: number;
      };
    }
  | { success: false; cooldownSeconds: number; message: string };

type EraseResult =
  | {
      success: true;
      erased: number;
      state: {
        isAdmin: boolean;
        pixelsLeft: number | null;
        cooldownSeconds: number;
      } | null;
    }
  | { success: false; message: string };

const anonymousCooldowns = new Map<
  string,
  { pixelsUsed: number; cooldownUntil: Date | null }
>();

@Injectable()
export class PixelService {
  constructor(
    private prisma: PrismaService,
    private gateway: PixelGateway,
  ) {}

  async checkAndPaint(
    x: number,
    y: number,
    color: string,
    userId: number | null,
    nickname: string | null,
    ip: string,
  ): Promise<PaintResult> {
    if (userId) {
      return await this.paintAsUser(x, y, color, userId, nickname);
    } else {
      return await this.paintAsAnonymous(x, y, color, ip);
    }
  }

  private async paintAsUser(
    x: number,
    y: number,
    color: string,
    userId: number,
    nickname: string | null,
  ): Promise<PaintResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'Usuario no encontrado',
      };

    if (!user.isAdmin) {
      const limit = TIER_LIMITS[user.subscriptionTier];
      const now = new Date();

      if (user.cooldownUntil && user.cooldownUntil > now) {
        const cooldownSeconds = Math.ceil(
          (user.cooldownUntil.getTime() - now.getTime()) / 1000,
        );
        return { success: false, cooldownSeconds, message: 'En cooldown' };
      }

      if (user.cooldownUntil && user.cooldownUntil <= now) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { pixelsUsed: 0, cooldownUntil: null },
        });
        user.pixelsUsed = 0;
        user.cooldownUntil = null;
      }

      if (limit.pixels !== Infinity && user.pixelsUsed >= limit.pixels) {
        const cooldownUntil = new Date(
          Date.now() + limit.cooldownHours * 60 * 60 * 1000,
        );
        await this.prisma.user.update({
          where: { id: userId },
          data: { cooldownUntil },
        });
        const cooldownSeconds = limit.cooldownHours * 60 * 60;
        return { success: false, cooldownSeconds, message: 'Límite alcanzado' };
      }
    }

    await this.prisma.pixel.upsert({
      where: { x_y: { x, y } },
      update: { color, userId, paintedAt: new Date() },
      create: { x, y, color, userId },
    });

    this.gateway.broadcastPixel(x, y, color, nickname);

    if (!user.isAdmin) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { pixelsUsed: { increment: 1 } },
      });
    }

    const updated = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const limit = TIER_LIMITS[updated!.subscriptionTier];

    let cooldownSeconds = 0;
    if (
      !updated!.isAdmin &&
      limit.pixels !== Infinity &&
      updated!.pixelsUsed >= limit.pixels
    ) {
      const cooldownUntil = new Date(
        Date.now() + limit.cooldownHours * 60 * 60 * 1000,
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { cooldownUntil },
      });
      cooldownSeconds = limit.cooldownHours * 60 * 60;
    }

    return {
      success: true,
      state: {
        isAdmin: updated!.isAdmin,
        pixelsLeft:
          updated!.isAdmin || limit.pixels === Infinity
            ? null
            : Math.max(limit.pixels - updated!.pixelsUsed, 0),
        cooldownSeconds,
      },
    };
  }

  private async paintAsAnonymous(
    x: number,
    y: number,
    color: string,
    ip: string,
  ): Promise<PaintResult> {
    const now = new Date();
    const state = anonymousCooldowns.get(ip) ?? {
      pixelsUsed: 0,
      cooldownUntil: null,
    };

    if (state.cooldownUntil && state.cooldownUntil > now) {
      const cooldownSeconds = Math.ceil(
        (state.cooldownUntil.getTime() - now.getTime()) / 1000,
      );
      return { success: false, cooldownSeconds, message: 'En cooldown' };
    }

    if (state.cooldownUntil && state.cooldownUntil <= now) {
      state.pixelsUsed = 0;
      state.cooldownUntil = null;
    }

    if (state.pixelsUsed >= 30) {
      state.cooldownUntil = new Date(Date.now() + 3 * 60 * 60 * 1000);
      anonymousCooldowns.set(ip, state);
      return {
        success: false,
        cooldownSeconds: 3 * 60 * 60,
        message: 'Límite alcanzado',
      };
    }

    await this.prisma.pixel.upsert({
      where: { x_y: { x, y } },
      update: { color, userId: null, paintedAt: new Date() },
      create: { x, y, color, userId: null },
    });

    this.gateway.broadcastPixel(x, y, color, null);

    state.pixelsUsed += 1;
    anonymousCooldowns.set(ip, state);

    return {
      success: true,
      state: {
        isAdmin: false,
        pixelsLeft: 30 - state.pixelsUsed,
        cooldownSeconds: 0,
      },
    };
  }
  getAnonymousState(ip: string): {
    pixelsLeft: number;
    cooldownSeconds: number;
  } {
    const now = new Date();
    const state = anonymousCooldowns.get(ip);

    if (!state) {
      return { pixelsLeft: 30, cooldownSeconds: 0 };
    }

    if (state.cooldownUntil && state.cooldownUntil <= now) {
      state.pixelsUsed = 0;
      state.cooldownUntil = null;
      anonymousCooldowns.set(ip, state);
    }

    const cooldownActive = state.cooldownUntil && state.cooldownUntil > now;
    const cooldownSeconds = cooldownActive
      ? Math.ceil((state.cooldownUntil!.getTime() - now.getTime()) / 1000)
      : 0;

    return {
      pixelsLeft: Math.max(30 - state.pixelsUsed, 0),
      cooldownSeconds,
    };
  }

  // Devuelve el slot al borrar, respetando el cooldown (anti-farmeo)
  private async applyRefund(userId: number, count: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    const limit = TIER_LIMITS[user.subscriptionTier];
    const now = new Date();

    let pixelsUsed = user.pixelsUsed;
    let cooldownUntil = user.cooldownUntil;

    if (cooldownUntil && cooldownUntil <= now) {
      // El cooldown ya expiró: se resetea (recupera todo)
      pixelsUsed = 0;
      cooldownUntil = null;
      await this.prisma.user.update({
        where: { id: userId },
        data: { pixelsUsed: 0, cooldownUntil: null },
      });
    } else if (!cooldownUntil) {
      // No está en cooldown: recupera un slot por cada píxel borrado
      pixelsUsed = Math.max(pixelsUsed - count, 0);
      await this.prisma.user.update({
        where: { id: userId },
        data: { pixelsUsed },
      });
    }
    // Si está en cooldown activo (cooldownUntil > now): NO se toca pixelsUsed

    const cooldownActive = cooldownUntil && cooldownUntil > now;
    const cooldownSeconds = cooldownActive
      ? Math.ceil((cooldownUntil!.getTime() - now.getTime()) / 1000)
      : 0;

    return {
      isAdmin: user.isAdmin,
      pixelsLeft:
        user.isAdmin || limit.pixels === Infinity
          ? null
          : Math.max(limit.pixels - pixelsUsed, 0),
      cooldownSeconds,
    };
  }

  async eraseOne(userId: number, x: number, y: number): Promise<EraseResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: 'Usuario no encontrado' };

    const pixel = await this.prisma.pixel.findUnique({
      where: { x_y: { x, y } },
    });
    if (!pixel)
      return { success: false, message: 'No hay nada que borrar aquí' };

    if (!user.isAdmin && pixel.userId !== userId) {
      return {
        success: false,
        message: 'Solo puedes borrar tus propios píxeles',
      };
    }

    await this.prisma.pixel.delete({ where: { x_y: { x, y } } });
    this.gateway.broadcastErase([{ x, y }]);

    const state = user.isAdmin ? null : await this.applyRefund(userId, 1);
    return { success: true, erased: 1, state };
  }

  async eraseArea(
    userId: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): Promise<EraseResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { success: false, message: 'Usuario no encontrado' };

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    const pixels = await this.prisma.pixel.findMany({
      where: { x: { gte: minX, lte: maxX }, y: { gte: minY, lte: maxY } },
    });

    if (pixels.length === 0) {
      return {
        success: false,
        message: 'No hay píxeles que borrar en esta área',
      };
    }

    let cells: { x: number; y: number }[];

    if (user.isAdmin) {
      // Admin: borra todo el área (moderación)
      cells = pixels.map((p) => ({ x: p.x, y: p.y }));
      await this.prisma.pixel.deleteMany({
        where: { x: { gte: minX, lte: maxX }, y: { gte: minY, lte: maxY } },
      });
    } else {
      // Si hay píxeles de OTRO usuario, se bloquea todo
      const foreign = pixels.some(
        (p) => p.userId !== null && p.userId !== userId,
      );
      if (foreign) {
        return {
          success: false,
          message:
            'El área contiene píxeles de otro usuario. Píntalos primero para reclamarlos.',
        };
      }
      // Borra solo los tuyos (los anónimos/vacíos se quedan)
      const mine = pixels.filter((p) => p.userId === userId);
      if (mine.length === 0) {
        return {
          success: false,
          message: 'No tienes píxeles propios en esta área',
        };
      }
      cells = mine.map((p) => ({ x: p.x, y: p.y }));
      await this.prisma.pixel.deleteMany({
        where: {
          x: { gte: minX, lte: maxX },
          y: { gte: minY, lte: maxY },
          userId: userId,
        },
      });
    }

    this.gateway.broadcastErase(cells);

    const state = user.isAdmin
      ? null
      : await this.applyRefund(userId, cells.length);
    return { success: true, erased: cells.length, state };
  }
}
