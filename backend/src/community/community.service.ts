import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron } from '@nestjs/schedule';
import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';

const SIZE = 1000;

// Lunes 00:00 UTC de la semana que contiene a `d`
function mondayUTC(d: Date): Date {
  const base = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const diff = (base.getUTCDay() + 6) % 7; // días desde el lunes
  base.setUTCDate(base.getUTCDate() - diff);
  return base;
}

const RAINBOW_DENSITY = 6;
const FADE_FREQ = 0.15;

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '').trim();
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// hsl(h, s%, l%) -> rgb, idéntico al que usa el navegador
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}

function lerpRgb(a: string, b: string, t: number): [number, number, number] {
  const ca = hexToRgb(a) ?? [0, 0, 0];
  const cb = hexToRgb(b) ?? [255, 255, 255];
  return [
    Math.round(ca[0] + (cb[0] - ca[0]) * t),
    Math.round(ca[1] + (cb[1] - ca[1]) * t),
    Math.round(ca[2] + (cb[2] - ca[2]) * t),
  ];
}

// Puerto exacto de resolveColor (lib/colors.ts) a RGB
function resolveColorRgb(
  color: string | null,
  x: number,
  y: number,
): [number, number, number] {
  if (!color || color[0] === '#')
    return color ? (hexToRgb(color) ?? [0, 0, 0]) : [0, 0, 0];
  if (color === 'rainbow') {
    const hue = ((((x + y) * RAINBOW_DENSITY) % 360) + 360) % 360;
    return hslToRgb(hue, 85, 55);
  }
  if (color.startsWith('fade:')) {
    const [a, b] = color.slice(5).split(',');
    const t = (Math.sin((x + y) * FADE_FREQ) + 1) / 2;
    return lerpRgb(a, b, t);
  }
  return hexToRgb(color) ?? [0, 0, 0];
}

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  async listAnnouncements() {
    const items = await this.prisma.announcement.findMany({
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 50,
      include: { author: { select: { nickname: true } } },
    });
    return items.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      pinned: a.pinned,
      createdAt: a.createdAt,
      authorNickname: a.author?.nickname ?? null,
    }));
  }

  async createAnnouncement(
    userId: number,
    data: { title?: string; body?: string; pinned?: boolean },
  ) {
    const title = (data.title ?? '').trim();
    const body = (data.body ?? '').trim();
    if (!title) throw new BadRequestException('El título es obligatorio');
    if (!body) throw new BadRequestException('El contenido es obligatorio');
    if (title.length > 120)
      throw new BadRequestException('El título es demasiado largo');
    if (body.length > 4000)
      throw new BadRequestException('El contenido es demasiado largo');

    const created = await this.prisma.announcement.create({
      data: {
        title,
        body,
        pinned: data.pinned ?? false,
        authorId: userId,
      },
      include: { author: { select: { nickname: true } } },
    });
    return {
      id: created.id,
      title: created.title,
      body: created.body,
      pinned: created.pinned,
      createdAt: created.createdAt,
      authorNickname: created.author?.nickname ?? null,
    };
  }

  async deleteAnnouncement(id: number) {
    const existing = await this.prisma.announcement.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Aviso no encontrado');
    await this.prisma.announcement.delete({ where: { id } });
    return { success: true };
  }

  async listSnapshots() {
    const items = await this.prisma.canvasSnapshot.findMany({
      orderBy: { weekStart: 'desc' },
      take: 52,
    });
    return items.map((s) => ({
      id: s.id,
      weekStart: s.weekStart,
      imageUrl: s.imageUrl,
    }));
  }

  async generateSnapshot(weekStart: Date): Promise<{ imageUrl: string }> {
    const pixels = await this.prisma.pixel.findMany({
      select: { x: true, y: true, color: true },
    });

    const png = new PNG({ width: SIZE, height: SIZE });
    png.data.fill(255); // fondo blanco opaco

    for (const p of pixels) {
      if (p.x < 0 || p.x >= SIZE || p.y < 0 || p.y >= SIZE) continue;
      const [r, g, b] = resolveColorRgb(p.color, p.x, p.y);
      const idx = (SIZE * p.y + p.x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }

    const dir = path.join(process.cwd(), 'public', 'snapshots');
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `week-${weekStart.toISOString().slice(0, 10)}.png`;
    fs.writeFileSync(path.join(dir, fileName), PNG.sync.write(png));

    const imageUrl = `/snapshots/${fileName}`;
    await this.prisma.canvasSnapshot.upsert({
      where: { weekStart },
      update: { imageUrl },
      create: { weekStart, imageUrl },
    });
    return { imageUrl };
  }

  // Para probar a mano: captura el estado actual del lienzo (semana en curso)
  async generateCurrentWeekSnapshot() {
    return this.generateSnapshot(mondayUTC(new Date()));
  }

  // Lunes 00:10 UTC: captura la semana recién terminada
  @Cron('10 0 * * 1', { timeZone: 'UTC' })
  async weeklySnapshotCron() {
    const thisMonday = mondayUTC(new Date());
    const prevMonday = new Date(thisMonday);
    prevMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    await this.generateSnapshot(prevMonday);
  }
}
