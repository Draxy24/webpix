import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionTier } from '@prisma/client';

const TIER_LIMITS: Record<
  SubscriptionTier,
  { pixels: number; cooldownHours: number }
> = {
  FREE: { pixels: 20, cooldownHours: 3 },
  PLUS: { pixels: 60, cooldownHours: 1 },
  PREMIUM: { pixels: Infinity, cooldownHours: 0 },
};

// Para usuarios anónimos (sin cuenta) usamos memoria por ahora
const anonymousCooldowns = new Map<
  string,
  { pixelsUsed: number; cooldownUntil: Date | null }
>();

@Injectable()
export class PixelService {
  constructor(private prisma: PrismaService) {}

  async checkAndPaint(
    x: number,
    y: number,
    color: string,
    userId: number | null,
    ip: string,
  ) {
    if (userId) {
      return await this.paintAsUser(x, y, color, userId);
    } else {
      await this.paintAsAnonymous(x, y, color, ip);
      return null;
    }
  }

  private async paintAsUser(
    x: number,
    y: number,
    color: string,
    userId: number,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ForbiddenException('Usuario no encontrado');

    // Los admins no tienen cooldown ni límite
    if (!user.isAdmin) {
      const limit = TIER_LIMITS[user.subscriptionTier];

      // Si hay cooldown activo, verificamos si ya pasó
      if (user.cooldownUntil && user.cooldownUntil > new Date()) {
        const secondsLeft = Math.ceil(
          (user.cooldownUntil.getTime() - Date.now()) / 1000,
        );
        throw new ForbiddenException(
          `En cooldown. Tiempo restante: ${Math.ceil(secondsLeft / 60)} minutos`,
        );
      }

      // Si el cooldown ya pasó, reseteamos
      if (user.cooldownUntil && user.cooldownUntil <= new Date()) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { pixelsUsed: 0, cooldownUntil: null },
        });
        user.pixelsUsed = 0;
        user.cooldownUntil = null;
      }

      // Verificamos límite de píxeles
      if (limit.pixels !== Infinity && user.pixelsUsed >= limit.pixels) {
        const cooldownUntil = new Date(
          Date.now() + limit.cooldownHours * 60 * 60 * 1000,
        );
        await this.prisma.user.update({
          where: { id: userId },
          data: { cooldownUntil },
        });
        throw new ForbiddenException(
          `Límite alcanzado. Cooldown de ${limit.cooldownHours} hora(s) activado`,
        );
      }
    }

    // Pintamos el píxel
    await this.prisma.pixel.upsert({
      where: { x_y: { x, y } },
      update: { color, userId, paintedAt: new Date() },
      create: { x, y, color, userId },
    });

    // Actualizamos contador solo si no es admin
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

    return {
      isAdmin: updated!.isAdmin,
      pixelsLeft:
        updated!.isAdmin || limit.pixels === Infinity
          ? null
          : Math.max(limit.pixels - updated!.pixelsUsed, 0),
      cooldownSeconds: 0,
    };
  }

  private async paintAsAnonymous(
    x: number,
    y: number,
    color: string,
    ip: string,
  ) {
    const now = new Date();
    const state = anonymousCooldowns.get(ip) ?? {
      pixelsUsed: 0,
      cooldownUntil: null,
    };

    if (state.cooldownUntil && state.cooldownUntil > now) {
      const secondsLeft = Math.ceil(
        (state.cooldownUntil.getTime() - now.getTime()) / 1000,
      );
      throw new ForbiddenException(
        `En cooldown. Tiempo restante: ${Math.ceil(secondsLeft / 60)} minutos`,
      );
    }

    if (state.cooldownUntil && state.cooldownUntil <= now) {
      state.pixelsUsed = 0;
      state.cooldownUntil = null;
    }

    if (state.pixelsUsed >= 20) {
      state.cooldownUntil = new Date(Date.now() + 3 * 60 * 60 * 1000);
      anonymousCooldowns.set(ip, state);
      throw new ForbiddenException(
        'Límite alcanzado. Cooldown de 3 hora(s) activado',
      );
    }

    await this.prisma.pixel.upsert({
      where: { x_y: { x, y } },
      update: { color, userId: null, paintedAt: new Date() },
      create: { x, y, color, userId: null },
    });

    state.pixelsUsed += 1;
    anonymousCooldowns.set(ip, state);
  }
}
