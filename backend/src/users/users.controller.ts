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

    const pixelCount = await this.prisma.pixel.count({
      where: { userId: user.id },
    });

    return {
      nickname: user.nickname,
      profilePic: user.profilePic,
      createdAt: user.createdAt,
      pixelCount,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('me')
  async updateMe(
    @Request() req: { user: { id: number } },
    @Body() body: { profilePic?: string },
  ) {
    const updated = await this.prisma.user.update({
      where: { id: req.user.id },
      data: { profilePic: body.profilePic },
    });

    return {
      nickname: updated.nickname,
      profilePic: updated.profilePic,
    };
  }
}
