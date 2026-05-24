import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  async register(data: {
    email?: string;
    phone?: string;
    nickname: string;
    password: string;
    country?: string;
  }) {
    const existingNickname = await this.usersService.findByNickname(
      data.nickname,
    );
    if (existingNickname)
      throw new BadRequestException('El nickname ya está en uso');

    if (data.email) {
      const existingEmail = await this.usersService.findByEmail(data.email);
      if (existingEmail)
        throw new BadRequestException('El email ya está registrado');
    }

    if (data.phone) {
      const existingPhone = await this.usersService.findByPhone(data.phone);
      if (existingPhone)
        throw new BadRequestException('El teléfono ya está registrado');
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
      await this.sendPhoneVerification(user.id, data.phone);
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

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

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
    this.notificationService.sendEmailVerification(email, code);
  }

  private async sendPhoneVerification(userId: number, phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
    await this.prisma.verificationCode.create({
      data: { userId, code, type: 'PHONE', expiresAt },
    });
    this.notificationService.sendPhoneVerification(phone, code);
  }

  async verifyEmail(code: string) {
    const record = await this.prisma.verificationCode.findFirst({
      where: { code, type: 'EMAIL' },
    });
    if (!record) throw new BadRequestException('Código inválido');
    if (record.expiresAt < new Date())
      throw new BadRequestException('El código ha expirado');

    await this.prisma.user.update({
      where: { id: record.userId },
      data: { verified: true },
    });
    await this.prisma.verificationCode.delete({ where: { id: record.id } });
    return { success: true };
  }

  async verifyPhone(userId: number, code: string) {
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, code, type: 'PHONE' },
    });
    if (!record) throw new BadRequestException('Código inválido');
    if (record.expiresAt < new Date())
      throw new BadRequestException('El código ha expirado');

    await this.prisma.user.update({
      where: { id: userId },
      data: { verified: true },
    });
    await this.prisma.verificationCode.delete({ where: { id: record.id } });
    return { success: true };
  }

  async resendVerification(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');
    if (user.verified)
      throw new BadRequestException('La cuenta ya está verificada');

    await this.prisma.verificationCode.deleteMany({
      where: { userId, type: { in: ['EMAIL', 'PHONE'] } },
    });

    if (user.email) {
      await this.sendEmailVerification(user.id, user.email);
    } else if (user.phone) {
      await this.sendPhoneVerification(user.id, user.phone);
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
      this.notificationService.sendPasswordResetEmail(user.email, token);
    } else if (user.phone) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await this.prisma.verificationCode.create({
        data: { userId: user.id, code, type: 'PASSWORD_RESET', expiresAt },
      });
      this.notificationService.sendPasswordResetPhone(user.phone, code);
    }

    return { success: true };
  }

  async resetPassword(emailOrPhone: string, code: string, newPassword: string) {
    const user =
      (await this.usersService.findByEmail(emailOrPhone)) ??
      (await this.usersService.findByPhone(emailOrPhone));
    if (!user) throw new BadRequestException('Datos inválidos');

    const record = await this.prisma.verificationCode.findFirst({
      where: { userId: user.id, code, type: 'PASSWORD_RESET' },
    });
    if (!record) throw new BadRequestException('Código inválido');
    if (record.expiresAt < new Date())
      throw new BadRequestException('El código ha expirado');
    if (newPassword.length < 6)
      throw new BadRequestException(
        'La contraseña debe tener al menos 6 caracteres',
      );

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await this.prisma.verificationCode.delete({ where: { id: record.id } });
    return { success: true };
  }
}
