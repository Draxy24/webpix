import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response, Request as ExpressRequest } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
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

const REFRESH_COOKIE = 'webpix_rt';

function clearRefreshCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? '.webpix.art' : undefined,
    path: '/',
  });
}

function setRefreshCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd, // en local (http) no forzamos secure
    sameSite: isProd ? 'none' : 'lax', // cross-subdominio en prod
    domain: isProd ? '.webpix.art' : undefined, // compartida por *.webpix.art
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
  });
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private prisma: PrismaService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register({
      ...body,
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, result.refreshToken);
    return { token: result.token, nickname: result.nickname };
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login({
      ...body,
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, result.refreshToken);
    return { token: result.token, nickname: result.nickname };
  }

  @SkipThrottle()
  @Post('refresh')
  async refresh(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      throw new UnauthorizedException({ code: 'NO_REFRESH_TOKEN' });
    }
    const userId = await this.authService.validateRefreshToken(token);
    if (userId === null) {
      // Refresh inválido/expirado/revocado: limpiamos la cookie muerta.
      clearRefreshCookie(res);
      throw new UnauthorizedException({ code: 'INVALID_REFRESH' });
    }
    const accessToken = await this.authService.issueAccessToken(userId);
    return { token: accessToken };
  }

  @Post('logout')
  async logout(
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await this.authService.revokeRefreshToken(token);
    }
    clearRefreshCookie(res);
    return { success: true };
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

  @SkipThrottle()
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
      hasSeenWelcome: user.hasSeenWelcome,
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
      email: user.email,
      phone: user.phone,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('welcome-seen')
  markWelcomeSeen(@Request() req: { user: { id: number } }) {
    return this.authService.markWelcomeSeen(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('account')
  deleteAccount(@Request() req: { user: { id: number } }) {
    return this.authService.deleteAccount(req.user.id);
  }
}
