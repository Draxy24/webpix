import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { NotificationModule } from '../notifications/notification.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [
    UsersModule,
    NotificationModule,
    StripeModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET no está definido en el entorno');
        }
        return { secret, signOptions: { expiresIn: '7d' } };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
