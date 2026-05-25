import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET ?? 'secret_temporal',
    });
  }

  async validate(payload: { sub: number; nickname: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) throw new UnauthorizedException();

    const banned =
      user.banPermanent ||
      (user.bannedUntil != null && user.bannedUntil > new Date());

    return {
      id: user.id,
      nickname: user.nickname,
      isAdmin: user.isAdmin,
      banned,
    };
  }
}
