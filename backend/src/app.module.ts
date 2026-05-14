import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PixelModule } from './pixel/pixel.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, PixelModule],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
