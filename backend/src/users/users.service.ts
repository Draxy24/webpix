import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
}
