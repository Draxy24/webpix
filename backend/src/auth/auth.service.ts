import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async register(data: {
    email?: string;
    phone?: string;
    nickname: string;
    password: string;
  }) {
    // Verificar que no exista el nickname
    const existingNickname = await this.usersService.findByNickname(data.nickname);
    if (existingNickname) throw new BadRequestException('El nickname ya está en uso');

    // Verificar email o teléfono según lo que venga
    if (data.email) {
      const existingEmail = await this.usersService.findByEmail(data.email);
      if (existingEmail) throw new BadRequestException('El email ya está registrado');
    }

    if (data.phone) {
      const existingPhone = await this.usersService.findByPhone(data.phone);
      if (existingPhone) throw new BadRequestException('El teléfono ya está registrado');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await this.usersService.create({
      email: data.email,
      phone: data.phone,
      nickname: data.nickname,
      passwordHash,
    });

    const token = this.jwtService.sign({ sub: user.id, nickname: user.nickname });

    return { token, nickname: user.nickname };
  }

  async login(data: { emailOrPhone: string; password: string }) {
    const user =
      (await this.usersService.findByEmail(data.emailOrPhone)) ??
      (await this.usersService.findByPhone(data.emailOrPhone));

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    const token = this.jwtService.sign({ sub: user.id, nickname: user.nickname });

    return { token, nickname: user.nickname };
  }
}