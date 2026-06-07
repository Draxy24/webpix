import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SHOP_COSMETICS } from './shop.config';
import { COLOR_PALETTES } from './shop.config';

@Injectable()
export class ShopService {
  constructor(private prisma: PrismaService) {}

  // Lista lo que está a la venta, con el saldo del usuario y si ya lo tiene
  async listForUser(userId: number) {
    const cosmetics = await this.prisma.cosmetic.findMany({
      where: { active: true, priceBits: { not: null } },
      orderBy: [{ rarity: 'asc' }, { priceBits: 'asc' }],
    });
    const owned = await this.prisma.userCosmetic.findMany({
      where: { userId },
      select: { cosmeticId: true },
    });
    const ownedSet = new Set(owned.map((o) => o.cosmeticId));
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return {
      bits: user?.bits ?? 0,
      items: cosmetics.map((c) => ({
        id: c.id,
        key: c.key,
        type: c.type,
        name: c.name,
        description: c.description,
        rarity: c.rarity,
        priceBits: c.priceBits,
        data: c.data,
        owned: ownedSet.has(c.id),
      })),
    };
  }

  // Compra un cosmético con Bits (descuenta saldo y lo desbloquea)
  async buy(userId: number, cosmeticId: number) {
    const cosmetic = await this.prisma.cosmetic.findUnique({
      where: { id: cosmeticId },
    });
    if (!cosmetic || !cosmetic.active || cosmetic.priceBits == null) {
      throw new BadRequestException('Este objeto no está a la venta');
    }

    const already = await this.prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId } },
    });
    if (already) throw new BadRequestException('Ya tienes este objeto');

    // Descuento condicional: solo paga si el saldo alcanza (evita saldos negativos)
    const paid = await this.prisma.user.updateMany({
      where: { id: userId, bits: { gte: cosmetic.priceBits } },
      data: { bits: { decrement: cosmetic.priceBits } },
    });
    if (paid.count === 0) {
      throw new BadRequestException('No tienes suficientes Bits');
    }

    try {
      await this.prisma.userCosmetic.create({ data: { userId, cosmeticId } });
    } catch {
      // Si el desbloqueo falla (ej. carrera), devolvemos los Bits
      await this.prisma.user.update({
        where: { id: userId },
        data: { bits: { increment: cosmetic.priceBits } },
      });
      throw new BadRequestException('No se pudo completar la compra');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return {
      success: true,
      cosmeticKey: cosmetic.key,
      spent: cosmetic.priceBits,
      bits: user?.bits ?? 0,
    };
  }

  // Temporal (dev): siembra el catálogo de la tienda. Quitar/restringir antes del lanzamiento.
  async seedCatalog(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isAdmin) throw new ForbiddenException('Solo administradores');
    for (const c of SHOP_COSMETICS) {
      await this.prisma.cosmetic.upsert({
        where: { key: c.key },
        update: {
          type: c.type,
          name: c.name,
          description: c.description,
          source: 'SHOP',
          rarity: c.rarity,
          priceBits: c.priceBits,
          data: c.data ?? undefined,
          active: true,
        },
        create: {
          key: c.key,
          type: c.type,
          name: c.name,
          description: c.description,
          source: 'SHOP',
          rarity: c.rarity,
          priceBits: c.priceBits,
          data: c.data ?? undefined,
        },
      });
    }
    return { success: true, seeded: SHOP_COSMETICS.length };
  }
  async listPalettesForUser(userId: number) {
    const owned = await this.prisma.userCosmetic.findMany({
      where: { userId },
      select: { cosmeticId: true },
    });
    const ownedIds = new Set(owned.map((o) => o.cosmeticId));

    return Promise.all(
      COLOR_PALETTES.map(async (palette) => {
        const colors = await this.prisma.cosmetic.findMany({
          where: { key: { in: palette.colorKeys } },
        });
        const mapped = colors.map((c) => ({
          id: c.id,
          key: c.key,
          name: c.name,
          rarity: c.rarity,
          priceBits: c.priceBits,
          data: c.data,
          owned: ownedIds.has(c.id),
        }));
        const ownedCount = mapped.filter((m) => m.owned).length;
        return {
          key: palette.key,
          name: palette.name,
          description: palette.description,
          bundlePriceBits: palette.bundlePriceBits,
          colors: mapped,
          ownedCount,
          total: mapped.length,
          fullyOwned: ownedCount === mapped.length,
        };
      }),
    );
  }

  async buyPalette(userId: number, paletteKey: string) {
    const palette = COLOR_PALETTES.find((p) => p.key === paletteKey);
    if (!palette) throw new NotFoundException('Paleta no encontrada');

    const colors = await this.prisma.cosmetic.findMany({
      where: { key: { in: palette.colorKeys } },
    });
    if (colors.length === 0)
      throw new BadRequestException('Paleta sin colores');

    const owned = await this.prisma.userCosmetic.findMany({
      where: { userId, cosmeticId: { in: colors.map((c) => c.id) } },
      select: { cosmeticId: true },
    });
    const ownedIds = new Set(owned.map((o) => o.cosmeticId));
    const toGrant = colors.filter((c) => !ownedIds.has(c.id));

    if (toGrant.length === 0)
      throw new BadRequestException('Ya tienes toda esta paleta');

    // Cobro atómico (evita saldo negativo)
    const charged = await this.prisma.user.updateMany({
      where: { id: userId, bits: { gte: palette.bundlePriceBits } },
      data: { bits: { decrement: palette.bundlePriceBits } },
    });
    if (charged.count === 0)
      throw new BadRequestException('No tienes suficientes Bits');

    await this.prisma.userCosmetic.createMany({
      data: toGrant.map((c) => ({ userId, cosmeticId: c.id })),
      skipDuplicates: true,
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return { success: true, granted: toGrant.length, bits: user?.bits ?? 0 };
  }
}
