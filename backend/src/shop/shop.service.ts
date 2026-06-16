import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SHOP_COSMETICS } from './shop.config';
import { COLOR_PALETTES } from './shop.config';
import { BIT_PACKAGES } from './shop.config';
import { Cosmetic } from '@prisma/client';
import { SEASON_WINDOWS, SEASON_LABEL_PRIORITY } from './shop.config';
import { AchievementsService } from '../achievements/achievements.service';
import { OFFER_COUNT, OFFER_DISCOUNTS } from './shop.config';

@Injectable()
export class ShopService {
  constructor(
    private prisma: PrismaService,
    private achievements: AchievementsService,
  ) {}

  async listForUser(userId: number) {
    const RARITY_ORDER = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'];
    const cosmetics = (await this.getTodaysCosmetics()).sort((a, b) => {
      const ra = RARITY_ORDER.indexOf(a.rarity ?? 'COMMON');
      const rb = RARITY_ORDER.indexOf(b.rarity ?? 'COMMON');
      if (ra !== rb) return ra - rb;
      return (a.priceBits ?? 0) - (b.priceBits ?? 0);
    });
    const owned = await this.prisma.userCosmetic.findMany({
      where: { userId },
      select: { cosmeticId: true },
    });
    const ownedSet = new Set(owned.map((o) => o.cosmeticId));
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const season = this.getActiveSeason();
    const offers = this.getTodaysOffers(cosmetics);

    return {
      bits: user?.bits ?? 0,
      season,
      items: cosmetics.map((c) => {
        const offer = offers.get(c.id);
        return {
          id: c.id,
          key: c.key,
          type: c.type,
          name: c.name,
          description: c.description,
          rarity: c.rarity,
          priceBits: offer ? offer.priceBits : c.priceBits,
          originalPriceBits: offer ? offer.originalPriceBits : null,
          discountPercent: offer ? offer.discountPercent : null,
          data: c.data,
          theme: c.theme,
          owned: ownedSet.has(c.id),
        };
      }),
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

    // FOMO: solo se puede comprar lo que está en la rotación de hoy
    const todays = await this.getTodaysCosmetics();
    if (!todays.some((c) => c.id === cosmeticId)) {
      throw new BadRequestException('Este objeto no está disponible hoy');
    }

    // Precio efectivo: aplica la oferta del día si este objeto está rebajado
    const offers = this.getTodaysOffers(todays);
    const price = offers.get(cosmeticId)?.priceBits ?? cosmetic.priceBits;

    const already = await this.prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId } },
    });
    if (already) throw new BadRequestException('Ya tienes este objeto');

    // Descuento condicional: solo paga si el saldo alcanza (evita saldos negativos)
    // Descuento condicional: solo paga si el saldo alcanza (evita saldos negativos)
    const paid = await this.prisma.user.updateMany({
      where: { id: userId, bits: { gte: price } },
      data: { bits: { decrement: price } },
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
        data: { bits: { increment: price } },
      });
      throw new BadRequestException('No se pudo completar la compra');
    }

    const events = await this.achievements.checkCollection(userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return {
      success: true,
      cosmeticKey: cosmetic.key,
      spent: price,
      bits: user?.bits ?? 0,
      events,
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
          theme: c.theme ?? null,
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
          theme: c.theme ?? null,
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
        const keys = palette.colorKeys ?? [];
        const colors = keys.length
          ? await this.prisma.cosmetic.findMany({
              where: { key: { in: keys } },
            })
          : [];
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
          fullyOwned: mapped.length > 0 && ownedCount === mapped.length,
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

    const events = await this.achievements.checkCollection(userId);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return {
      success: true,
      granted: toGrant.length,
      bits: user?.bits ?? 0,
      events,
    };
  }

  listBitPackages() {
    return BIT_PACKAGES.map((p) => ({
      key: p.key,
      name: p.name,
      bits: p.bits,
      bonus: p.bonus,
      total: p.bits + p.bonus,
      priceCents: p.priceCents,
    }));
  }

  // STUB: otorga los Bits sin cobro real. Reemplazar por checkout + webhook de Stripe antes del lanzamiento.
  async buyBits(userId: number, packageKey: string) {
    const pkg = BIT_PACKAGES.find((p) => p.key === packageKey);
    if (!pkg) throw new NotFoundException('Paquete no encontrado');

    const total = pkg.bits + pkg.bonus;
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { bits: { increment: total } },
    });

    return { success: true, granted: total, bits: user.bits };
  }
  private dailySeed(date: Date): number {
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  private rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private shuffle<T>(arr: T[], rand: () => number): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private isThemeActive(theme: string | null, date: Date): boolean {
    if (!theme) return true;
    const w = SEASON_WINDOWS[theme];
    if (!w) return true; // estéticas/memes/elementos: siempre disponibles
    return w.months.includes(date.getUTCMonth() + 1);
  }

  private getActiveSeason(
    date: Date = new Date(),
  ): { themes: string[]; key: string; label: string } | null {
    const month = date.getUTCMonth() + 1;
    const themes = Object.keys(SEASON_WINDOWS).filter((k) =>
      SEASON_WINDOWS[k].months.includes(month),
    );
    if (themes.length === 0) return null;
    const labelKey = SEASON_LABEL_PRIORITY.find((k) => themes.includes(k));
    const key = labelKey ?? themes[0];
    return { themes, key, label: SEASON_WINDOWS[key].label };
  }

  // Ofertas del día: selección determinista de unos pocos items rebajados (cambia a medianoche UTC)
  private getTodaysOffers(
    cosmetics: Cosmetic[],
    date: Date = new Date(),
  ): Map<
    number,
    { discountPercent: number; originalPriceBits: number; priceBits: number }
  > {
    const pool = cosmetics
      .filter((c) => c.priceBits != null)
      .sort((a, b) => a.id - b.id);

    const rand = this.rng(this.dailySeed(date) + 104729);
    const chosen = this.shuffle(pool, rand).slice(0, OFFER_COUNT);

    const offers = new Map<
      number,
      { discountPercent: number; originalPriceBits: number; priceBits: number }
    >();
    for (const c of chosen) {
      const discount =
        OFFER_DISCOUNTS[Math.floor(rand() * OFFER_DISCOUNTS.length)];
      const original = c.priceBits as number;
      const sale = Math.max(1, Math.round(original * (1 - discount)));

      offers.set(c.id, {
        discountPercent: Math.round(discount * 100),
        originalPriceBits: original,
        priceBits: sale,
      });
    }

    return offers;
  }

  // Selección determinista del día (igual para todos, cambia a medianoche UTC)
  async getTodaysCosmetics(date: Date = new Date()): Promise<Cosmetic[]> {
    const all = await this.prisma.cosmetic.findMany({
      where: { active: true, priceBits: { not: null } },
    });
    const eligible = all.filter((c) => this.isThemeActive(c.theme, date));
    const seed = this.dailySeed(date);
    const PER_CATEGORY = 6;

    const chosenIds = new Set<number>();
    const result: Cosmetic[] = [];
    const add = (c: Cosmetic) => {
      if (!chosenIds.has(c.id)) {
        chosenIds.add(c.id);
        result.push(c);
      }
    };

    const types = [...new Set(eligible.map((c) => c.type))];
    types.forEach((type, i) => {
      const list = eligible
        .filter((c) => c.type === type)
        .sort((a, b) => a.key.localeCompare(b.key));
      this.shuffle(list, this.rng(seed + i * 7919))
        .slice(0, PER_CATEGORY)
        .forEach(add);
    });

    // Temporada activa: incluir todos sus items para que luzca la temporada
    eligible.forEach((c) => {
      if (c.theme && SEASON_WINDOWS[c.theme]) add(c);
    });

    return result;
  }
}
