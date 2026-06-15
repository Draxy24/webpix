import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { levelInfo } from '../rewards/rewards.config';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {}

  @Get(':nickname')
  async getProfile(@Param('nickname') nickname: string) {
    const user = await this.usersService.findByNickname(nickname);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const equipped = await this.prisma.userCosmetic.findMany({
      where: { userId: user.id, equipped: true },
      include: { cosmetic: true },
    });
    const titleCos = equipped.find(
      (e) => e.cosmetic.type === 'TITLE',
    )?.cosmetic;
    const badgeCos = equipped.find(
      (e) => e.cosmetic.type === 'BADGE',
    )?.cosmetic;
    const frame = equipped.find((e) => e.cosmetic.type === 'FRAME')?.cosmetic;
    const background = equipped.find(
      (e) => e.cosmetic.type === 'BACKGROUND',
    )?.cosmetic;

    return {
      nickname: user.nickname,
      profilePic: user.profilePic,
      country: user.country,
      createdAt: user.createdAt,
      pixelCount: user.pixelsPlaced,
      level: levelInfo(user.xp).level,
      title: titleCos
        ? { key: titleCos.key, name: titleCos.name, data: titleCos.data }
        : null,
      badge: badgeCos
        ? { key: badgeCos.key, name: badgeCos.name, data: badgeCos.data }
        : null,
      frame: frame
        ? { key: frame.key, name: frame.name, data: frame.data }
        : null,
      background: background
        ? { key: background.key, name: background.name, data: background.data }
        : null,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  async updateMe(
    @Request() req: { user: { id: number } },
    @Body() body: { profilePic?: string; country?: string },
  ) {
    const updated = await this.prisma.user.update({
      where: { id: req.user.id },
      data: {
        profilePic: body.profilePic,
        country: body.country,
      },
    });

    return {
      nickname: updated.nickname,
      profilePic: updated.profilePic,
      country: updated.country,
    };
  }
}
