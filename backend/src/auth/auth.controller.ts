import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Throttle } from '@nestjs/throttler';
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  VerifyPhoneDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

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

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  register(
    @Body()
    body: RegisterDto,
  ) {
    return this.authService.register(body);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-email')
  verifyEmail(@Body() body: VerifyEmailDto) {
    return this.authService.verifyEmail(body.code);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'))
  @Post('verify-phone')
  verifyPhone(
    @Request() req: { user: { id: number } },
    @Body() body: VerifyPhoneDto,
  ) {
    return this.authService.verifyPhone(req.user.id, body.code);
  }

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(AuthGuard('jwt'))
  @Post('resend-verification')
  resendVerification(@Request() req: { user: { id: number } }) {
    return this.authService.resendVerification(req.user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.emailOrPhone);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
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

    const now = new Date();

    const isBanned =
      user.banPermanent || (user.bannedUntil != null && user.bannedUntil > now);

    let needsVerification: 'email' | 'phone' | null = null;
    if (!user.verified) {
      needsVerification = user.email ? 'email' : 'phone';
    }

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
      banned: isBanned,
      banReason: user.banReason,
      bannedUntil: user.bannedUntil,
      banPermanent: user.banPermanent,
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

  @UseGuards(AuthGuard('jwt'))
  @Delete('account')
  deleteAccount(@Request() req: { user: { id: number } }) {
    return this.authService.deleteAccount(req.user.id);
  }
}
