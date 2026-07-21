import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtModule } from '@nestjs/jwt';
import { PixelModule } from '../pixel/pixel.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
  imports: [
    PixelModule,
    StorageModule,
    NotificationModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret)
          throw new Error('JWT_SECRET no está definido en el entorno');
        return { secret, signOptions: { expiresIn: '15m' } };
      },
    }),
  ],
})
export class UsersModule {}
