import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type CacheEntry = { color: string; nickname: string | null };

@Injectable()
export class PixelCacheService implements OnModuleInit {
  private readonly logger = new Logger(PixelCacheService.name);
  // Estado del lienzo en memoria. Clave: "x,y".
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const pixels = await this.prisma.pixel.findMany({
      include: { user: { select: { nickname: true } } },
    });
    this.cache.clear();
    for (const p of pixels) {
      this.cache.set(`${p.x},${p.y}`, {
        color: p.color,
        nickname: p.user?.nickname ?? null,
      });
    }
    this.logger.log(`Lienzo cargado en memoria: ${this.cache.size} píxeles`);
  }

  set(x: number, y: number, color: string, nickname: string | null) {
    this.cache.set(`${x},${y}`, { color, nickname });
  }

  delete(x: number, y: number) {
    this.cache.delete(`${x},${y}`);
  }

  deleteMany(cells: { x: number; y: number }[]) {
    for (const c of cells) this.cache.delete(`${c.x},${c.y}`);
  }

  snapshot(): {
    colors: Record<string, string>;
    owners: Record<string, string>;
  } {
    const colors: Record<string, string> = {};
    const owners: Record<string, string> = {};
    for (const [key, entry] of this.cache) {
      colors[key] = entry.color;
      if (entry.nickname) owners[key] = entry.nickname;
    }
    return { colors, owners };
  }
}
