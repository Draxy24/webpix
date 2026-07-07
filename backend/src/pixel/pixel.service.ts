import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PixelGateway } from './pixel.gateway';
import { PrivateSpacesService } from '../private-spaces/private-spaces.service';
import { SubscriptionTier } from '@prisma/client';
import { AchievementsService } from '../achievements/achievements.service';
import { RewardEvent } from '../achievements/reward-event';

const TIER_LIMITS: Record<
  SubscriptionTier,
  { pixels: number; cooldownHours: number }
> = {
  FREE: { pixels: 60, cooldownHours: 2 },
  PLUS: { pixels: 120, cooldownHours: 0.5 },
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
      events: RewardEvent[];
    }
  | {
      success: false;
      cooldownSeconds: number;
      message: string;
      code: string;
    };

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
  | { success: false; message: string; code: string };

const MAX_BATCH = 500;

type PaintBatchResult =
  | {
      success: true;
      painted: number;
      requested: number;
      skipped: { x: number; y: number }[];
      state: {
        isAdmin: boolean;
        pixelsLeft: number | null;
        cooldownSeconds: number;
      };
      events: RewardEvent[];
    }
  | {
      success: false;
      cooldownSeconds: number;
      message: string;
      code: string;
    };

const anonymousCooldowns = new Map<
  string,
  { pixelsUsed: number; cooldownUntil: Date | null }
>();

function isHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color);
}

@Injectable()
export class PixelService {
  constructor(
    private prisma: PrismaService,
    private gateway: PixelGateway,
    private privateSpaces: PrivateSpacesService,
    private achievements: AchievementsService,
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
        code: 'USER_NOT_FOUND',
      };

    // Color exótico (token): el usuario debe poseerlo
    if (!isHexColor(color) && !(await this.userOwnsColorToken(userId, color))) {
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'No posees este color exótico',
        code: 'COLOR_NOT_OWNED',
      };
    }

    // ¿Cae dentro de un espacio privado?
    const access = await this.privateSpaces.checkPaintAccess(userId, x, y);
    if (access.inSpace) {
      const canPaintHere = access.allowed || user.isAdmin;
      if (!canPaintHere) {
        return {
          success: false,
          cooldownSeconds: 0,
          message: 'Este píxel pertenece a un espacio privado',
          code: 'PIXEL_IN_PRIVATE_SPACE',
        };
      }

      // Pintado libre dentro de un espacio con acceso: no consume cuota ni cooldown
      const now = new Date();
      if (!user.isAdmin && user.cooldownUntil && user.cooldownUntil <= now) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { pixelsUsed: 0, cooldownUntil: null },
        });
        user.pixelsUsed = 0;
        user.cooldownUntil = null;
      }

      await this.prisma.pixel.upsert({
        where: { x_y: { x, y } },
        update: { color, userId, paintedAt: new Date() },
        create: { x, y, color, userId },
      });
      this.gateway.broadcastPixel(x, y, color, nickname);

      const limit = TIER_LIMITS[user.subscriptionTier];
      const cooldownActive = user.cooldownUntil && user.cooldownUntil > now;
      const cooldownSeconds = cooldownActive
        ? Math.ceil((user.cooldownUntil!.getTime() - now.getTime()) / 1000)
        : 0;

      return {
        success: true,
        state: {
          isAdmin: user.isAdmin,
          pixelsLeft:
            user.isAdmin || limit.pixels === Infinity
              ? null
              : Math.max(limit.pixels - user.pixelsUsed, 0),
          cooldownSeconds,
        },
        events: [],
      };
    }

    // ----- Flujo normal (fuera de espacios privados) -----
    if (!user.isAdmin) {
      const limit = TIER_LIMITS[user.subscriptionTier];
      const now = new Date();

      if (user.cooldownUntil && user.cooldownUntil > now) {
        const cooldownSeconds = Math.ceil(
          (user.cooldownUntil.getTime() - now.getTime()) / 1000,
        );
        return {
          success: false,
          cooldownSeconds,
          message: 'En cooldown',
          code: 'COOLDOWN',
        };
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
        return {
          success: false,
          cooldownSeconds,
          message: 'Límite alcanzado',
          code: 'LIMIT_REACHED',
        };
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

    const events = await this.achievements.track(userId, 'PIXELS_PLACED');
    await this.achievements.recordMonthly(userId, 'pixels');

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
      events,
    };
  }

  private async paintAsAnonymous(
    x: number,
    y: number,
    color: string,
    ip: string,
  ): Promise<PaintResult> {
    // Los anónimos no pueden usar colores exóticos
    if (!isHexColor(color)) {
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'Inicia sesión para usar colores exóticos',
        code: 'LOGIN_FOR_EXOTIC',
      };
    }
    // Los anónimos no pueden pintar dentro de espacios privados
    const access = await this.privateSpaces.checkPaintAccess(null, x, y);
    if (access.inSpace) {
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'Este píxel pertenece a un espacio privado',
        code: 'PIXEL_IN_PRIVATE_SPACE',
      };
    }

    const now = new Date();
    const state = anonymousCooldowns.get(ip) ?? {
      pixelsUsed: 0,
      cooldownUntil: null,
    };

    if (state.cooldownUntil && state.cooldownUntil > now) {
      const cooldownSeconds = Math.ceil(
        (state.cooldownUntil.getTime() - now.getTime()) / 1000,
      );
      return {
        success: false,
        cooldownSeconds,
        message: 'En cooldown',
        code: 'COOLDOWN',
      };
    }

    if (state.cooldownUntil && state.cooldownUntil <= now) {
      state.pixelsUsed = 0;
      state.cooldownUntil = null;
    }

    if (state.pixelsUsed >= 60) {
      state.cooldownUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
      anonymousCooldowns.set(ip, state);
      return {
        success: false,
        cooldownSeconds: 2 * 60 * 60,
        message: 'Límite alcanzado',
        code: 'LIMIT_REACHED',
      };
    }

    await this.prisma.pixel.upsert({
      where: { x_y: { x, y } },
      update: { color, userId: null, paintedAt: new Date() },
      create: { x, y, color, userId: null },
    });

    this.gateway.broadcastPixel(x, y, color, null);

    state.pixelsUsed += 1;

    // Si este píxel agotó la cuota, arma el cooldown YA y devuélvelo en esta
    // misma respuesta exitosa, para que el anónimo vea el reloj sin tener que
    // intentar (y fallar) un píxel de más.
    let cooldownSeconds = 0;
    if (state.pixelsUsed >= 60) {
      state.cooldownUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
      cooldownSeconds = 2 * 60 * 60;
    }

    anonymousCooldowns.set(ip, state);

    return {
      success: true,
      state: {
        isAdmin: false,
        pixelsLeft: Math.max(60 - state.pixelsUsed, 0),
        cooldownSeconds,
      },
      events: [],
    };
  }

  getAnonymousState(ip: string): {
    pixelsLeft: number;
    cooldownSeconds: number;
  } {
    const now = new Date();
    const state = anonymousCooldowns.get(ip);

    if (!state) {
      return { pixelsLeft: 60, cooldownSeconds: 0 };
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
      pixelsLeft: Math.max(60 - state.pixelsUsed, 0),
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
      pixelsUsed = 0;
      cooldownUntil = null;
      await this.prisma.user.update({
        where: { id: userId },
        data: { pixelsUsed: 0, cooldownUntil: null },
      });
    } else if (!cooldownUntil) {
      pixelsUsed = Math.max(pixelsUsed - count, 0);
      await this.prisma.user.update({
        where: { id: userId },
        data: { pixelsUsed },
      });
    }

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
    if (!user)
      return {
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      };

    const pixel = await this.prisma.pixel.findUnique({
      where: { x_y: { x, y } },
    });
    if (!pixel)
      return {
        success: false,
        message: 'No hay nada que borrar aquí',
        code: 'NOTHING_TO_ERASE',
      };

    // Admin borra cualquier cosa (moderación), sin reembolso
    if (user.isAdmin) {
      await this.prisma.pixel.delete({ where: { x_y: { x, y } } });
      this.gateway.broadcastErase([{ x, y }]);
      return { success: true, erased: 1, state: null };
    }

    // ¿Dentro de un espacio privado?
    const access = await this.privateSpaces.checkPaintAccess(userId, x, y);
    if (access.inSpace) {
      if (!access.allowed) {
        return {
          success: false,
          message: 'Este píxel pertenece a un espacio privado',
          code: 'PIXEL_IN_PRIVATE_SPACE',
        };
      }
      // Con acceso: puedes borrar, pero sin reembolso (pintar ahí fue gratis)
      await this.prisma.pixel.delete({ where: { x_y: { x, y } } });
      this.gateway.broadcastErase([{ x, y }]);
      return { success: true, erased: 1, state: null };
    }

    // Fuera de espacios privados: solo tus propios píxeles, con reembolso
    if (pixel.userId !== userId) {
      return {
        success: false,
        message: 'Solo puedes borrar tus propios píxeles',
        code: 'ERASE_ONLY_OWN',
      };
    }

    await this.prisma.pixel.delete({ where: { x_y: { x, y } } });
    this.gateway.broadcastErase([{ x, y }]);
    const state = await this.applyRefund(userId, 1);
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
    if (!user)
      return {
        success: false,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      };

    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    // Los no-admin no pueden borrar en área sobre espacios privados (usen modo punto ahí)
    if (!user.isAdmin) {
      const overlaps = await this.privateSpaces.overlapsActiveSpace(
        minX,
        maxX,
        minY,
        maxY,
      );
      if (overlaps) {
        return {
          success: false,
          message:
            'El área toca un espacio privado. Usa el modo punto dentro de espacios privados.',
          code: 'AREA_TOUCHES_PRIVATE',
        };
      }
    }

    const pixels = await this.prisma.pixel.findMany({
      where: { x: { gte: minX, lte: maxX }, y: { gte: minY, lte: maxY } },
    });

    if (pixels.length === 0) {
      return {
        success: false,
        message: 'No hay píxeles que borrar en esta área',
        code: 'AREA_EMPTY_ERASE',
      };
    }

    let cells: { x: number; y: number }[];

    if (user.isAdmin) {
      cells = pixels.map((p) => ({ x: p.x, y: p.y }));
      await this.prisma.pixel.deleteMany({
        where: { x: { gte: minX, lte: maxX }, y: { gte: minY, lte: maxY } },
      });
    } else {
      const foreign = pixels.some(
        (p) => p.userId !== null && p.userId !== userId,
      );
      if (foreign) {
        return {
          success: false,
          message:
            'El área contiene píxeles de otro usuario. Píntalos primero para reclamarlos.',
          code: 'AREA_HAS_FOREIGN',
        };
      }
      const mine = pixels.filter((p) => p.userId === userId);
      if (mine.length === 0) {
        return {
          success: false,
          message: 'No tienes píxeles propios en esta área',
          code: 'AREA_NO_OWN',
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

  private async userOwnsColorToken(
    userId: number,
    token: string,
  ): Promise<boolean> {
    const owned = await this.prisma.userCosmetic.findMany({
      where: { userId, cosmetic: { type: 'COLOR' } },
      include: { cosmetic: true },
    });
    return owned.some((uc) => {
      const data = uc.cosmetic.data as { token?: string } | null;
      return data?.token === token;
    });
  }

  async checkAndPaintBatch(
    cells: { x: number; y: number }[],
    color: string,
    userId: number | null,
    nickname: string | null,
    ip: string,
  ): Promise<PaintBatchResult> {
    // Dedup: un arrastre puede repetir celdas; no deben consumir cuota doble.
    const seen = new Set<string>();
    const unique: { x: number; y: number }[] = [];
    for (const c of cells) {
      const k = `${c.x},${c.y}`;
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(c);
      }
    }

    if (unique.length === 0)
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'Tanda vacía',
        code: 'BATCH_EMPTY',
      };
    if (unique.length > MAX_BATCH)
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'Tanda demasiado grande',
        code: 'BATCH_TOO_LARGE',
      };

    if (userId) {
      return this.paintBatchAsUser(unique, color, userId, nickname);
    }
    return this.paintBatchAsAnonymous(unique, color, ip);
  }

  private async paintBatchAsUser(
    cells: { x: number; y: number }[],
    color: string,
    userId: number,
    nickname: string | null,
  ): Promise<PaintBatchResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      };

    // Color exótico: verificar posesión UNA vez para toda la tanda.
    if (!isHexColor(color) && !(await this.userOwnsColorToken(userId, color)))
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'No posees este color exótico',
        code: 'COLOR_NOT_OWNED',
      };

    const now = new Date();
    const limit = TIER_LIMITS[user.subscriptionTier];

    // ----- Clasificar celdas (fuera del lock: no toca cuota) -----
    const freeCells: { x: number; y: number }[] = [];
    const normalCells: { x: number; y: number }[] = [];

    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    const touchesPrivate = await this.privateSpaces.overlapsActiveSpace(
      Math.min(...xs),
      Math.max(...xs),
      Math.min(...ys),
      Math.max(...ys),
    );

    if (!touchesPrivate) {
      normalCells.push(...cells);
    } else {
      for (const c of cells) {
        const access = await this.privateSpaces.checkPaintAccess(
          userId,
          c.x,
          c.y,
        );
        if (access.inSpace) {
          if (access.allowed || user.isAdmin) freeCells.push(c);
        } else {
          normalCells.push(c);
        }
      }
    }

    // ============================================================
    // SECCIÓN CRÍTICA: reserva de cuota bajo lock de fila.
    // Serializa batches concurrentes del MISMO usuario. El lock es
    // corto: solo leemos cuota, decidimos cuánto cabe y reservamos.
    // Los upserts de píxeles y los logros van DESPUÉS, fuera del lock.
    // ============================================================
    const reservation = await this.prisma.$transaction(async (tx) => {
      // Lock de la fila del usuario. Otro batch del mismo user espera aquí.
      const locked = await tx.$queryRaw<
        Array<{
          pixelsUsed: number;
          cooldownUntil: Date | null;
          isAdmin: boolean;
        }>
      >`SELECT "pixelsUsed", "cooldownUntil", "isAdmin"
    FROM "User" WHERE id = ${userId} FOR UPDATE`;

      const row = locked[0];
      if (!row) {
        return {
          normalToPaint: [] as { x: number; y: number }[],
          cooldownActive: false,
          pixelsUsed: 0,
          cooldownUntil: null as Date | null,
        };
      }

      let pixelsUsed = row.pixelsUsed;
      let cooldownUntil = row.cooldownUntil;
      let cooldownActive = false;

      if (!row.isAdmin) {
        if (cooldownUntil && cooldownUntil > now) {
          cooldownActive = true;
        } else if (cooldownUntil && cooldownUntil <= now) {
          // Cooldown expirado: resetear cuota dentro del lock.
          await tx.user.update({
            where: { id: userId },
            data: { pixelsUsed: 0, cooldownUntil: null },
          });
          pixelsUsed = 0;
          cooldownUntil = null;
        }
      }

      // Cuánto de lo "normal" cabe con la cuota ACTUAL (ya bloqueada).
      let normalToPaint: { x: number; y: number }[];
      if (row.isAdmin || limit.pixels === Infinity) {
        normalToPaint = normalCells;
      } else if (cooldownActive) {
        normalToPaint = [];
      } else {
        const available = Math.max(limit.pixels - pixelsUsed, 0);
        normalToPaint = normalCells.slice(0, available);
      }

      // Reservar la cuota AQUÍ (dentro del lock), antes de pintar.
      const normalCount = normalToPaint.length;
      if (!row.isAdmin && normalCount > 0) {
        pixelsUsed += normalCount;
        const data: {
          pixelsUsed: { increment: number };
          cooldownUntil?: Date;
        } = { pixelsUsed: { increment: normalCount } };
        // Si esta reserva agota el límite, armamos el cooldown ya mismo.
        if (
          limit.pixels !== Infinity &&
          pixelsUsed >= limit.pixels &&
          !cooldownUntil
        ) {
          cooldownUntil = new Date(
            Date.now() + limit.cooldownHours * 60 * 60 * 1000,
          );
          data.cooldownUntil = cooldownUntil;
        }
        await tx.user.update({ where: { id: userId }, data });
      } else if (
        // Aunque no reservemos nada nuevo, si ya está en el límite, fijar cooldown.
        !row.isAdmin &&
        limit.pixels !== Infinity &&
        pixelsUsed >= limit.pixels &&
        !cooldownUntil
      ) {
        cooldownUntil = new Date(
          Date.now() + limit.cooldownHours * 60 * 60 * 1000,
        );
        await tx.user.update({
          where: { id: userId },
          data: { cooldownUntil },
        });
      }

      return {
        normalToPaint,
        cooldownActive,
        pixelsUsed,
        cooldownUntil,
        isAdmin: row.isAdmin,
      };
    });

    const {
      normalToPaint,
      cooldownActive,
      pixelsUsed,
      cooldownUntil,
      isAdmin,
    } = reservation as {
      normalToPaint: { x: number; y: number }[];
      cooldownActive: boolean;
      pixelsUsed: number;
      cooldownUntil: Date | null;
      isAdmin: boolean;
    };

    const toPaint = [...freeCells, ...normalToPaint];

    // ----- Nada que pintar: devolver el motivo (ya con cuota consistente) -----
    if (toPaint.length === 0) {
      if (cooldownActive && cooldownUntil) {
        return {
          success: false,
          cooldownSeconds: Math.ceil(
            (cooldownUntil.getTime() - now.getTime()) / 1000,
          ),
          message: 'En cooldown',
          code: 'COOLDOWN',
        };
      }
      if (cooldownUntil && cooldownUntil > new Date()) {
        return {
          success: false,
          cooldownSeconds: Math.ceil(
            (cooldownUntil.getTime() - Date.now()) / 1000,
          ),
          message: 'Límite alcanzado',
          code: 'LIMIT_REACHED',
        };
      }
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'No se pintó ningún píxel',
        code: 'NOTHING_PAINTED',
      };
    }

    // ----- Persistir píxeles y difundir (FUERA del lock) -----
    const paintedAt = new Date();
    await this.prisma.$transaction(
      toPaint.map((c) =>
        this.prisma.pixel.upsert({
          where: { x_y: { x: c.x, y: c.y } },
          update: { color, userId, paintedAt },
          create: { x: c.x, y: c.y, color, userId },
        }),
      ),
    );
    for (const c of toPaint)
      this.gateway.broadcastPixel(c.x, c.y, color, nickname);

    // ----- Logros/XP/mensual (FUERA del lock) -----
    let events: RewardEvent[] = [];
    const normalPainted = normalToPaint.length;
    if (normalPainted > 0) {
      events = await this.achievements.track(
        userId,
        'PIXELS_PLACED',
        normalPainted,
      );
      await this.achievements.recordMonthly(userId, 'pixels', normalPainted);
    }

    // ----- Armar respuesta con los valores ya calculados bajo lock -----
    let cooldownSeconds = 0;
    let pixelsLeft: number | null = null;

    if (isAdmin || limit.pixels === Infinity) {
      pixelsLeft = null;
    } else {
      pixelsLeft = Math.max(limit.pixels - pixelsUsed, 0);
      if (cooldownUntil && cooldownUntil > new Date()) {
        cooldownSeconds = Math.ceil(
          (cooldownUntil.getTime() - Date.now()) / 1000,
        );
      }
    }

    const paintedSet = new Set(toPaint.map((c) => `${c.x},${c.y}`));
    const skipped = cells.filter((c) => !paintedSet.has(`${c.x},${c.y}`));

    return {
      success: true,
      painted: toPaint.length,
      requested: cells.length,
      skipped,
      state: { isAdmin, pixelsLeft, cooldownSeconds },
      events,
    };
  }

  private async paintBatchAsAnonymous(
    cells: { x: number; y: number }[],
    color: string,
    ip: string,
  ): Promise<PaintBatchResult> {
    if (!isHexColor(color))
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'Inicia sesión para usar colores exóticos',
        code: 'LOGIN_FOR_EXOTIC',
      };

    const now = new Date();
    const state = anonymousCooldowns.get(ip) ?? {
      pixelsUsed: 0,
      cooldownUntil: null,
    };

    if (state.cooldownUntil && state.cooldownUntil > now)
      return {
        success: false,
        cooldownSeconds: Math.ceil(
          (state.cooldownUntil.getTime() - now.getTime()) / 1000,
        ),
        message: 'En cooldown',
        code: 'COOLDOWN',
      };
    if (state.cooldownUntil && state.cooldownUntil <= now) {
      state.pixelsUsed = 0;
      state.cooldownUntil = null;
    }

    // Anónimos no pueden pintar dentro de espacios privados: filtrarlas.
    let paintable = cells;
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    if (
      await this.privateSpaces.overlapsActiveSpace(
        Math.min(...xs),
        Math.max(...xs),
        Math.min(...ys),
        Math.max(...ys),
      )
    ) {
      const ok: { x: number; y: number }[] = [];
      for (const c of cells) {
        const access = await this.privateSpaces.checkPaintAccess(
          null,
          c.x,
          c.y,
        );
        if (!access.inSpace) ok.push(c);
      }
      paintable = ok;
    }

    const available = Math.max(60 - state.pixelsUsed, 0);
    const toPaint = paintable.slice(0, available);

    if (toPaint.length === 0) {
      if (available === 0) {
        state.cooldownUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
        anonymousCooldowns.set(ip, state);
        return {
          success: false,
          cooldownSeconds: 2 * 60 * 60,
          message: 'Límite alcanzado',
          code: 'LIMIT_REACHED',
        };
      }
      return {
        success: false,
        cooldownSeconds: 0,
        message: 'No se pintó ningún píxel',
        code: 'NOTHING_PAINTED',
      };
    }

    const paintedAt = new Date();
    await this.prisma.$transaction(
      toPaint.map((c) =>
        this.prisma.pixel.upsert({
          where: { x_y: { x: c.x, y: c.y } },
          update: { color, userId: null, paintedAt },
          create: { x: c.x, y: c.y, color, userId: null },
        }),
      ),
    );
    for (const c of toPaint) this.gateway.broadcastPixel(c.x, c.y, color, null);

    state.pixelsUsed += toPaint.length;

    // Si esta tanda agotó la cuota, arma el cooldown YA y devuélvelo en esta
    // misma respuesta exitosa (mismo criterio que el pintado de un solo píxel).
    let cooldownSeconds = 0;
    if (state.pixelsUsed >= 60) {
      state.cooldownUntil = new Date(Date.now() + 2 * 60 * 60 * 1000);
      cooldownSeconds = 2 * 60 * 60;
    }

    anonymousCooldowns.set(ip, state);

    const paintedSet = new Set(toPaint.map((c) => `${c.x},${c.y}`));
    const skipped = cells.filter((c) => !paintedSet.has(`${c.x},${c.y}`));

    return {
      success: true,
      painted: toPaint.length,
      requested: cells.length,
      skipped,
      state: {
        isAdmin: false,
        pixelsLeft: Math.max(60 - state.pixelsUsed, 0),
        cooldownSeconds,
      },
      events: [],
    };
  }
}
