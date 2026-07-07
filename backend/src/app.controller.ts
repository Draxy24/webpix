import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Res,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { PixelService } from './pixel/pixel.service';
import { PixelCacheService } from './pixel/pixel-cache.service';
import { OptionalJwtGuard } from './auth/optional-jwt.guard';
import { AuthGuard } from '@nestjs/passport';
import { NotBannedGuard } from './auth/not-banned.guard';
import { SetPixelDto, EraseDto, EraseAreaDto } from './dto/app.dto';
import { Throttle } from '@nestjs/throttler';
import { PaintBatchDto } from './dto/app.dto';

const ANON_COOKIE = 'webpix_anon';
const ANON_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 año

// Lee la cookie del anónimo; si no existe, genera un UUID y la setea.
// Devuelve el anonId a usar. Solo relevante para usuarios NO registrados.
function ensureAnonId(
  req: { cookies?: Record<string, string> },
  res: Response,
): string {
  const existing = req.cookies?.[ANON_COOKIE];
  if (existing) return existing;
  const id = randomUUID();
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(ANON_COOKIE, id, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? '.webpix.art' : undefined,
    path: '/',
    maxAge: ANON_COOKIE_MAX_AGE,
  });
  return id;
}

@Controller()
export class AppController {
  constructor(
    private pixelService: PixelService,
    private pixelCache: PixelCacheService,
  ) {}

  @Get('pixels')
  getPixels() {
    return this.pixelCache.snapshot();
  }

  @Get('anonymous-state')
  getAnonymousState(
    @Request() req: { cookies?: Record<string, string>; ip?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const anonId = ensureAnonId(req, res);
    const ip = req.ip ?? 'unknown';
    return this.pixelService.getAnonymousState(anonId, ip);
  }

  @Throttle({ default: { limit: 600, ttl: 60000 } })
  @UseGuards(OptionalJwtGuard)
  @Post('pixel')
  async setPixel(
    @Body() body: SetPixelDto,
    @Request()
    req: {
      user?: { id: number; nickname: string; banned?: boolean };
      cookies?: Record<string, string>;
      ip?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.user?.banned) {
      throw new ForbiddenException('Tu cuenta está suspendida');
    }
    const userId = req.user?.id ?? null;
    const nickname = req.user?.nickname ?? null;
    const ip = req.ip ?? 'unknown';
    // La cookie solo importa para anónimos; los registrados usan su userId.
    const anonId = userId ? '' : ensureAnonId(req, res);
    return await this.pixelService.checkAndPaint(
      body.x,
      body.y,
      body.color,
      userId,
      nickname,
      ip,
      anonId,
    );
  }

  @Throttle({ default: { limit: 600, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Post('erase')
  async erasePixel(
    @Request() req: { user: { id: number } },
    @Body() body: EraseDto,
  ) {
    return this.pixelService.eraseOne(req.user.id, body.x, body.y);
  }

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Post('erase-area')
  async eraseAreaEndpoint(
    @Request() req: { user: { id: number } },
    @Body() body: EraseAreaDto,
  ) {
    return this.pixelService.eraseArea(
      req.user.id,
      body.x1,
      body.y1,
      body.x2,
      body.y2,
    );
  }

  @Throttle({ default: { limit: 600, ttl: 60000 } })
  @UseGuards(OptionalJwtGuard)
  @Post('pixel-batch')
  async setPixelBatch(
    @Body() body: PaintBatchDto,
    @Request()
    req: {
      user?: { id: number; nickname: string; banned?: boolean };
      cookies?: Record<string, string>;
      ip?: string;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (req.user?.banned) {
      throw new ForbiddenException('Tu cuenta está suspendida');
    }
    const userId = req.user?.id ?? null;
    const anonId = userId ? '' : ensureAnonId(req, res);
    return this.pixelService.checkAndPaintBatch(
      body.cells,
      body.color,
      userId,
      req.user?.nickname ?? null,
      req.ip ?? 'unknown',
      anonId,
    );
  }
}
