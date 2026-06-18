import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PixelModule } from './pixel/pixel.module';
import { FriendshipsModule } from './friendships/friendships.module';
import { PublicationsModule } from './publications/publications.module';
import { RankingsModule } from './rankings/rankings.module';
import { ModerationModule } from './moderation/moderation.module';
import { PrivateSpacesModule } from './private-spaces/private-spaces.module';
import { RewardsModule } from './rewards/rewards.module';
import { AchievementsModule } from './achievements/achievements.module';
import { WeeklyTasksModule } from './weekly-tasks/weekly-tasks.module';
import { ShopModule } from './shop/shop.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CommunityModule } from './community/community.module';
import { StripeModule } from './stripe/stripe.module';

@Module({
  imports: [
    // Backstop global: 120 req/min por IP. Es deliberadamente generoso; ajústalo a tu
    // tráfico real. El pintado de píxeles va por el gateway WebSocket, así que NO se ve
    // afectado por este guard HTTP (el lienzo sigue fluido).
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    PixelModule,
    FriendshipsModule,
    PublicationsModule,
    RankingsModule,
    ModerationModule,
    PrivateSpacesModule,
    RewardsModule,
    AchievementsModule,
    WeeklyTasksModule,
    ShopModule,
    ScheduleModule.forRoot(),
    CommunityModule,
    StripeModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
