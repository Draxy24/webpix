import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const TIER_LIMITS = {
  FREE: { pixels: 30, cooldownHours: 3 },
  PLUS: { pixels: 60, cooldownHours: 1 },
  PREMIUM: { pixels: Infinity, cooldownHours: 0 },
};

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Post('register')
  register(
    @Body()
    body: {
      email?: string;
      phone?: string;
      nickname: string;
      password: string;
      country?: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: { emailOrPhone: string; password: string }) {
    return this.authService.login(body);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: { code: string }) {
    return this.authService.verifyEmail(body.code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('verify-phone')
  verifyPhone(
    @Request() req: { user: { id: number } },
    @Body() body: { code: string },
  ) {
    return this.authService.verifyPhone(req.user.id, body.code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('resend-verification')
  resendVerification(@Request() req: { user: { id: number } }) {
    return this.authService.resendVerification(req.user.id);
  }

  @Post('forgot-password')
  forgotPassword(@Body() body: { emailOrPhone: string }) {
    return this.authService.forgotPassword(body.emailOrPhone);
  }

  @Post('reset-password')
  resetPassword(
    @Body() body: { emailOrPhone: string; code: string; newPassword: string },
  ) {
    return this.authService.resetPassword(
      body.emailOrPhone,
      body.code,
      body.newPassword,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMe(@Request() req: { user: { id: number; nickname: string } }) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) return null;

    let needsVerification: 'email' | 'phone' | null = null;
    if (!user.verified) {
      needsVerification = user.email ? 'email' : 'phone';
    }

    const now = new Date();
    let pixelsUsed = user.pixelsUsed;

    if (user.cooldownUntil && user.cooldownUntil <= now) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { pixelsUsed: 0, cooldownUntil: null },
      });
      pixelsUsed = 0;
    }

    const limit = TIER_LIMITS[user.subscriptionTier];
    const cooldownActive = user.cooldownUntil && user.cooldownUntil > now;
    const cooldownSeconds = cooldownActive
      ? Math.ceil((user.cooldownUntil!.getTime() - now.getTime()) / 1000)
      : 0;

    return {
      nickname: user.nickname,
      isAdmin: user.isAdmin,
      verified: user.verified,
      needsVerification,
      subscriptionTier: user.subscriptionTier,
      pixelsUsed,
      pixelLimit:
        user.isAdmin || limit.pixels === Infinity ? null : limit.pixels,
      pixelsLeft:
        user.isAdmin || limit.pixels === Infinity
          ? null
          : Math.max(limit.pixels - pixelsUsed, 0),
      cooldownSeconds,
    };
  }
}
