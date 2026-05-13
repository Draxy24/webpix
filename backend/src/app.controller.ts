import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { OptionalJwtGuard } from './auth/optional-jwt.guard';

@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

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
    @Request() req: { user?: { id: number; nickname: string } },
  ) {
    const userId = req.user?.id ?? null;

    await this.prisma.pixel.upsert({
      where: { x_y: { x: body.x, y: body.y } },
      update: { color: body.color, userId, paintedAt: new Date() },
      create: { x: body.x, y: body.y, color: body.color, userId },
    });

    return { success: true };
  }
}
