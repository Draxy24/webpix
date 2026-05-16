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
}
