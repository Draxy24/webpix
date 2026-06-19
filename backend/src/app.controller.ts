import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { PixelService } from './pixel/pixel.service';
import { OptionalJwtGuard } from './auth/optional-jwt.guard';
import { AuthGuard } from '@nestjs/passport';
import { NotBannedGuard } from './auth/not-banned.guard';
import { SetPixelDto, EraseDto, EraseAreaDto } from './dto/app.dto';

@Controller()
export class AppController {
  constructor(
    private prisma: PrismaService,
    private pixelService: PixelService,
  ) {}

  @Get('pixels')
  async getPixels() {
    const pixels = await this.prisma.pixel.findMany({
      include: { user: { select: { nickname: true } } },
    });

    const colors: Record<string, string> = {};
    const owners: Record<string, string> = {};

    for (const pixel of pixels) {
      const key = `${pixel.x},${pixel.y}`;
      colors[key] = pixel.color;
      if (pixel.user?.nickname) owners[key] = pixel.user.nickname;
    }

    return { colors, owners };
  }

  @Get('anonymous-state')
  getAnonymousState(@Request() req: { ip?: string }) {
    const ip = req.ip ?? 'unknown';
    return this.pixelService.getAnonymousState(ip);
  }

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
