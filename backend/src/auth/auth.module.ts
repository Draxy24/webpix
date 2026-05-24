import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    UsersModule,
    NotificationModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'secret_temporal',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
