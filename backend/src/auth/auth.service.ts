import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { StripeService } from '../stripe/stripe.service';

const MAX_CODE_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private stripe: StripeService,
  ) {}

  async deleteAccount(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException({
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      });
    }

    // 1. Cancelar suscripciones en Stripe (llamada externa, fuera de la transacción).
    //    Si falla, abortamos y NO borramos, para no dejar una suscripción cobrando.
    if (user.stripeCustomerId) {
      await this.stripe.cancelSubscriptionsForCustomer(user.stripeCustomerId);
    }

    // 2. Limpieza y borrado en una sola transacción.
    await this.prisma.$transaction(async (tx) => {
      // Los píxeles del lienzo común permanecen, pero sin dueño (anonimizados).
      await tx.pixel.updateMany({ where: { userId }, data: { userId: null } });

      // Relaciones que NO cascadean desde User: hay que limpiarlas a mano.
      await tx.friendship.deleteMany({
        where: { OR: [{ senderId: userId }, { receiverId: userId }] },
      });
      await tx.publicationReaction.deleteMany({ where: { userId } });
      await tx.publicationComment.deleteMany({ where: { userId } });
      await tx.publication.deleteMany({ where: { userId } });

      // Al borrar el usuario cascadean solas: verificationCodes, privateSpaces
      // (+ members), waitlist, cosmetics, achievements, weeklyTasks,
      // monthlyScores, rankingWins. Announcement.authorId queda en null.
      await tx.user.delete({ where: { id: userId } });
    });

    return { success: true };
  }

  async markWelcomeSeen(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { hasSeenWelcome: true },
    });
    return { success: true };
  }

  async register(data: {
    email?: string;
    phone?: string;
    nickname: string;
    password: string;
    country?: string;
  }) {
    if (!data.password || data.password.length < 6)
      throw new BadRequestException({
        message: 'La contraseña debe tener al menos 6 caracteres',
        code: 'PASSWORD_TOO_SHORT',
        params: { min: 6 },
      });
    const existingNickname = await this.usersService.findByNickname(
      data.nickname,
    );
    if (existingNickname)
      throw new BadRequestException({
        message: 'El nickname ya está en uso',
        code: 'NICKNAME_TAKEN',
      });

    if (data.email) {
      const existingEmail = await this.usersService.findByEmail(data.email);
      if (existingEmail)
        throw new BadRequestException({
          message: 'El email ya está registrado',
          code: 'EMAIL_TAKEN',
        });
    }

    if (data.phone) {
      const existingPhone = await this.usersService.findByPhone(data.phone);
      if (existingPhone)
        throw new BadRequestException({
          message: 'El teléfono ya está registrado',
          code: 'PHONE_TAKEN',
        });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await this.usersService.create({
      email: data.email,
      phone: data.phone,
      nickname: data.nickname,
      passwordHash,
      country: data.country,
    });

    // Enviar verificación según el método de registro
    if (data.email) {
      await this.sendEmailVerification(user.id, data.email);
    } else if (data.phone) {
      await this.sendPhoneVerification(data.phone);
    }

    const token = this.jwtService.sign({
      sub: user.id,
      nickname: user.nickname,
    });
    return { token, nickname: user.nickname };
  }

  async login(data: { emailOrPhone: string; password: string }) {
    const user =
      (await this.usersService.findByEmail(data.emailOrPhone)) ??
      (await this.usersService.findByPhone(data.emailOrPhone));

    if (!user)
      throw new UnauthorizedException({
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS',
      });

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid)
      throw new UnauthorizedException({
        message: 'Credenciales inválidas',
        code: 'INVALID_CREDENTIALS',
      });

    const banned =
      user.banPermanent ||
      (user.bannedUntil != null && user.bannedUntil > new Date());

    if (banned) {
      throw new ForbiddenException({
        message: 'Tu cuenta está suspendida',
        code: 'ACCOUNT_SUSPENDED',
        banned: true,
        banReason: user.banReason,
        bannedUntil: user.bannedUntil,
        banPermanent: user.banPermanent,
      });
    }

    const token = this.jwtService.sign({
      sub: user.id,
      nickname: user.nickname,
    });
    return { token, nickname: user.nickname };
  }

  // ---- Verificación ----

  private async sendEmailVerification(userId: number, email: string) {
    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
    await this.prisma.verificationCode.create({
      data: { userId, code, type: 'EMAIL', expiresAt },
    });
    await this.notificationService.sendEmailVerification(email, code);
  }

  private async sendPhoneVerification(phone: string) {
    await this.notificationService.startPhoneVerification(phone);
  }

  async verifyEmail(code: string) {
    const record = await this.prisma.verificationCode.findFirst({
      where: { code, type: 'EMAIL' },
    });
    if (!record)
      throw new BadRequestException({
        message: 'Código inválido',
        code: 'INVALID_CODE',
      });
    if (record.expiresAt < new Date())
      throw new BadRequestException({
        message: 'El código ha expirado',
        code: 'CODE_EXPIRED',
      });

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { verified: true },
    });
    await this.prisma.verificationCode.delete({ where: { id: record.id } });
    return { success: true };
  }

  async verifyPhone(userId: number, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone)
      throw new BadRequestException({
        message: 'Código inválido',
        code: 'INVALID_CODE',
      });
    const ok = await this.notificationService.checkPhoneVerification(
      user.phone,
      code,
    );
    if (!ok)
      throw new BadRequestException({
        message: 'Código inválido',
        code: 'INVALID_CODE',
      });
    await this.prisma.user.update({
      where: { id: userId },
      data: { verified: true },
    });
    return { success: true };
  }

  async resendVerification(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new BadRequestException({
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      });
    if (user.verified)
      throw new BadRequestException({
        message: 'La cuenta ya está verificada',
        code: 'ALREADY_VERIFIED',
      });

    await this.prisma.verificationCode.deleteMany({
      where: { userId, type: { in: ['EMAIL', 'PHONE'] } },
    });

    if (user.email) {
      await this.sendEmailVerification(user.id, user.email);
    } else if (user.phone) {
      await this.sendPhoneVerification(user.phone);
    }
    return { success: true };
  }

  // ---- Recuperación de contraseña ----

  async forgotPassword(emailOrPhone: string) {
    const user =
      (await this.usersService.findByEmail(emailOrPhone)) ??
      (await this.usersService.findByPhone(emailOrPhone));

    // Siempre devolvemos éxito para no revelar si la cuenta existe
    if (!user) return { success: true };

    await this.prisma.verificationCode.deleteMany({
      where: { userId: user.id, type: 'PASSWORD_RESET' },
    });

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    if (user.email && user.email === emailOrPhone) {
      const token = crypto.randomBytes(16).toString('hex');
      await this.prisma.verificationCode.create({
        data: {
          userId: user.id,
          code: token,
          type: 'PASSWORD_RESET',
          expiresAt,
        },
      });
      await this.notificationService.sendPasswordResetEmail(user.email, token);
    } else if (user.phone) {
      await this.notificationService.startPhoneVerification(user.phone);
    }

    return { success: true };
  }

  async resetPassword(emailOrPhone: string, code: string, newPassword: string) {
    const user =
      (await this.usersService.findByEmail(emailOrPhone)) ??
      (await this.usersService.findByPhone(emailOrPhone));
    if (!user)
      throw new BadRequestException({
        message: 'Datos inválidos',
        code: 'INVALID_RESET_DATA',
      });

    const isPhone = user.phone != null && user.phone === emailOrPhone;
    let resetRecordId: number | null = null;

    if (isPhone) {
      const ok = await this.notificationService.checkPhoneVerification(
        user.phone!,
        code,
      );
      if (!ok)
        throw new BadRequestException({
          message: 'Código inválido',
          code: 'INVALID_CODE',
        });
    } else {
      const record = await this.prisma.verificationCode.findFirst({
        where: { userId: user.id, type: 'PASSWORD_RESET' },
        orderBy: { id: 'desc' },
      });
      if (!record)
        throw new BadRequestException({
          message: 'Código inválido',
          code: 'INVALID_CODE',
        });
      if (record.expiresAt < new Date()) {
        await this.prisma.verificationCode.delete({ where: { id: record.id } });
        throw new BadRequestException({
          message: 'El código ha expirado',
          code: 'CODE_EXPIRED',
        });
      }
      if (record.attempts >= MAX_CODE_ATTEMPTS) {
        await this.prisma.verificationCode.delete({ where: { id: record.id } });
        throw new BadRequestException({
          message: 'Demasiados intentos. Solicita un código nuevo.',
          code: 'TOO_MANY_ATTEMPTS',
        });
      }
      if (record.code !== code) {
        await this.prisma.verificationCode.update({
          where: { id: record.id },
          data: { attempts: { increment: 1 } },
        });
        throw new BadRequestException({
          message: 'Código inválido',
          code: 'INVALID_CODE',
        });
      }
      resetRecordId = record.id;
    }

    if (newPassword.length < 6)
      throw new BadRequestException({
        message: 'La contraseña debe tener al menos 6 caracteres',
        code: 'PASSWORD_TOO_SHORT',
        params: { min: 6 },
      });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    if (resetRecordId !== null) {
      await this.prisma.verificationCode.delete({
        where: { id: resetRecordId },
      });
    }
  }
}
