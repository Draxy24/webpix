import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import { NotificationService } from 'src/notifications/notification.service';
import { RewardsService } from 'src/rewards/rewards.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private rewards: RewardsService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findByPhone(phone: string) {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  async findById(id: number) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByNickname(nickname: string) {
    return this.prisma.user.findUnique({ where: { nickname } });
  }

  async create(data: {
    email?: string;
    phone?: string;
    nickname: string;
    passwordHash: string;
    country?: string;
  }) {
    return this.prisma.user.create({ data });
  }

  // Añade un email a la cuenta. Reglas: el usuario NO debe tener email ya,
  // y el email no debe estar en uso por otra cuenta. Queda SIN verificar.
  async addEmail(userId: number, email: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      });
    }
    // Regla de oro: nunca sobrescribir un contacto existente.
    if (user.email) {
      throw new BadRequestException({
        message: 'Ya tienes un correo registrado',
        code: 'EMAIL_ALREADY_SET',
      });
    }
    const taken = await this.prisma.user.findUnique({ where: { email } });
    if (taken) {
      throw new BadRequestException({
        message: 'Ese correo ya está en uso',
        code: 'EMAIL_TAKEN',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { email, emailVerified: false },
    });
    return { success: true };
  }

  // Añade un teléfono a la cuenta. Mismas reglas que addEmail.
  async addPhone(userId: number, phone: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({
        message: 'Usuario no encontrado',
        code: 'USER_NOT_FOUND',
      });
    }
    if (user.phone) {
      throw new BadRequestException({
        message: 'Ya tienes un teléfono registrado',
        code: 'PHONE_ALREADY_SET',
      });
    }
    const taken = await this.prisma.user.findUnique({ where: { phone } });
    if (taken) {
      throw new BadRequestException({
        message: 'Ese teléfono ya está en uso',
        code: 'PHONE_TAKEN',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneVerified: false },
    });
    return { success: true };
  }

  // ---- Verificación del segundo método (no bloqueante) ----

  // Inicia la verificación del email de la cuenta (debe existir y no estar verificado).
  async startEmailVerification(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) {
      throw new BadRequestException({
        message: 'No tienes un correo registrado',
        code: 'NO_EMAIL',
      });
    }
    if (user.emailVerified) {
      throw new BadRequestException({
        message: 'Tu correo ya está verificado',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }
    // Limpiamos códigos previos de este tipo y generamos uno nuevo.
    await this.prisma.verificationCode.deleteMany({
      where: { userId, type: 'EMAIL' },
    });
    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.verificationCode.create({
      data: { userId, code, type: 'EMAIL', expiresAt },
    });
    await this.notificationService.sendEmailVerification(user.email, code);
    return { success: true };
  }

  // Confirma el email con el código recibido → marca emailVerified.
  async confirmEmailVerification(userId: number, code: string) {
    const record = await this.prisma.verificationCode.findFirst({
      where: { userId, code, type: 'EMAIL' },
    });
    if (!record) {
      throw new BadRequestException({
        message: 'Código inválido',
        code: 'INVALID_CODE',
      });
    }
    if (record.expiresAt < new Date()) {
      await this.prisma.verificationCode.delete({ where: { id: record.id } });
      throw new BadRequestException({
        message: 'El código ha expirado',
        code: 'CODE_EXPIRED',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
    await this.prisma.verificationCode.delete({ where: { id: record.id } });

    // Welcome package (one-time, idempotente). NO debe romper la verificación si falla.
    try {
      await this.rewards.grantWelcomePackage(userId);
    } catch (err) {
      console.error('grantWelcomePackage (email) falló:', err);
    }

    return { success: true };
  }

  // Inicia la verificación del teléfono (Twilio Verify).
  async startPhoneVerification(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) {
      throw new BadRequestException({
        message: 'No tienes un teléfono registrado',
        code: 'NO_PHONE',
      });
    }
    if (user.phoneVerified) {
      throw new BadRequestException({
        message: 'Tu teléfono ya está verificado',
        code: 'PHONE_ALREADY_VERIFIED',
      });
    }
    await this.notificationService.startPhoneVerification(user.phone);
    return { success: true };
  }

  // Confirma el teléfono con el código del SMS → marca phoneVerified.
  async confirmPhoneVerification(userId: number, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) {
      throw new BadRequestException({
        message: 'No tienes un teléfono registrado',
        code: 'NO_PHONE',
      });
    }
    const ok = await this.notificationService.checkPhoneVerification(
      user.phone,
      code,
    );
    if (!ok) {
      throw new BadRequestException({
        message: 'Código inválido',
        code: 'INVALID_CODE',
      });
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerified: true },
    });

    try {
      await this.rewards.grantWelcomePackage(userId);
    } catch (err) {
      console.error('grantWelcomePackage (phone) falló:', err);
    }

    return { success: true };
  }
}
