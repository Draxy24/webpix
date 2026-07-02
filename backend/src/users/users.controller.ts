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
import { AddEmailDto, AddPhoneDto, UpdateMeDto } from './dto/users.dto';
import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PixelCacheService } from '../pixel/pixel-cache.service';
import { Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { StorageService } from '../storage/storage.service';

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private pixelCache: PixelCacheService,
    private jwt: JwtService,
    private storage: StorageService,
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
    @Body() body: UpdateMeDto,
  ) {
    const current = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!current) throw new NotFoundException('Usuario no encontrado');

    let nicknameChanged = false;
    if (body.nickname && body.nickname !== current.nickname) {
      const taken = await this.usersService.findByNickname(body.nickname);
      if (taken) {
        throw new BadRequestException({
          message: 'El nickname ya está en uso',
          code: 'NICKNAME_TAKEN',
        });
      }
      nicknameChanged = true;
    }

    const updated = await this.prisma.user.update({
      where: { id: req.user.id },
      data: {
        profilePic: body.profilePic,
        country: body.country,
        ...(nicknameChanged ? { nickname: body.nickname } : {}),
      },
    });

    // Si cambió el nickname: sincronizamos el caché del lienzo y emitimos token nuevo
    let token: string | undefined;
    if (nicknameChanged) {
      this.pixelCache.updateNickname(current.nickname, updated.nickname);
      token = this.jwt.sign({ sub: updated.id, nickname: updated.nickname });
    }

    return {
      nickname: updated.nickname,
      profilePic: updated.profilePic,
      country: updated.country,
      token, // solo viene cuando cambió el nickname
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/email')
  async addEmail(
    @Request() req: { user: { id: number } },
    @Body() body: AddEmailDto,
  ) {
    return this.usersService.addEmail(req.user.id, body.email);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/phone')
  async addPhone(
    @Request() req: { user: { id: number } },
    @Body() body: AddPhoneDto,
  ) {
    return this.usersService.addPhone(req.user.id, body.phone);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadAvatar(
    @Request() req: { user: { id: number } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException({
        message: 'No se recibió ninguna imagen',
        code: 'NO_FILE',
      });
    }

    let processed: Buffer;
    try {
      processed = await sharp(file.buffer)
        .rotate() // respeta la orientación EXIF antes de descartar metadatos
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new BadRequestException({
        message: 'El archivo no es una imagen válida',
        code: 'INVALID_IMAGE',
      });
    }

    const key = `avatars/${req.user.id}-${randomUUID()}.webp`;
    const url = await this.storage.uploadObject(key, processed, 'image/webp');

    await this.prisma.user.update({
      where: { id: req.user.id },
      data: { profilePic: url },
    });

    return { profilePic: url };
  }
}
