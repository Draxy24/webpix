import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PixelModule } from './pixel/pixel.module';
import { FriendshipsModule } from './friendships/friendships.module';
import { PublicationsModule } from './publications/publications.module';
import { RankingsModule } from './rankings/rankings.module';
import { ModerationModule } from './moderation/moderation.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    PixelModule,
    FriendshipsModule,
    PublicationsModule,
    RankingsModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
