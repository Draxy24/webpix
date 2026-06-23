import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { PixelService } from './pixel/pixel.service';
import { PixelCacheService } from './pixel/pixel-cache.service';
import { OptionalJwtGuard } from './auth/optional-jwt.guard';
import { AuthGuard } from '@nestjs/passport';
import { NotBannedGuard } from './auth/not-banned.guard';
import { SetPixelDto, EraseDto, EraseAreaDto } from './dto/app.dto';
import { Throttle } from '@nestjs/throttler';

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
  getAnonymousState(@Request() req: { ip?: string }) {
    const ip = req.ip ?? 'unknown';
    return this.pixelService.getAnonymousState(ip);
  }

  @Throttle({ default: { limit: 600, ttl: 60000 } })
  @UseGuards(OptionalJwtGuard)
  @Post('pixel')
  async setPixel(
    @Body() body: SetPixelDto,
    @Request()
    req: {
      user?: { id: number; nickname: string; banned?: boolean };
      ip?: string;
    },
  ) {
    if (req.user?.banned) {
      throw new ForbiddenException('Tu cuenta está suspendida');
    }
    const userId = req.user?.id ?? null;
    const nickname = req.user?.nickname ?? null;
    const ip = req.ip ?? 'unknown';
    return await this.pixelService.checkAndPaint(
      body.x,
      body.y,
      body.color,
      userId,
      nickname,
      ip,
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
}
