import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtModule } from '@nestjs/jwt';
import { PixelModule } from '../pixel/pixel.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
  imports: [
    PixelModule,
    StorageModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret)
          throw new Error('JWT_SECRET no está definido en el entorno');
        return { secret, signOptions: { expiresIn: '7d' } };
      },
    }),
  ],
})
export class UsersModule {}
