import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { PixelService } from './pixel/pixel.service';
import { OptionalJwtGuard } from './auth/optional-jwt.guard';

@Controller()
export class AppController {
  constructor(
    private prisma: PrismaService,
    private pixelService: PixelService,
  ) {}

  @Get('pixels')
  async getPixels() {
    const pixels = await this.prisma.pixel.findMany();
    const result: Record<string, string> = {};
    for (const pixel of pixels) {
      result[`${pixel.x},${pixel.y}`] = pixel.color;
    }
    return result;
  }

  @UseGuards(OptionalJwtGuard)
  @Post('pixel')
  async setPixel(
    @Body() body: { x: number; y: number; color: string },
    @Request() req: { user?: { id: number; nickname: string }; ip?: string },
  ) {
    const userId = req.user?.id ?? null;
    const ip = req.ip ?? 'unknown';

    const state = await this.pixelService.checkAndPaint(
      body.x,
      body.y,
      body.color,
      userId,
      ip,
    );

    return { success: true, state };
  }
}
