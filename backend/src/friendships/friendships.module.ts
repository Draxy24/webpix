import { Module } from '@nestjs/common';
import { FriendshipsController } from './friendships.controller';
import { FriendshipsService } from './friendships.service';
import { AchievementsModule } from '../achievements/achievements.module';
import { PixelModule } from '../pixel/pixel.module';

@Module({
  controllers: [FriendshipsController],
  providers: [FriendshipsService],
  imports: [AchievementsModule, PixelModule],
})
export class FriendshipsModule {}
