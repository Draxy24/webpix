import { Module } from '@nestjs/common';
import { FriendshipsController } from './friendships.controller';
import { FriendshipsService } from './friendships.service';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  controllers: [FriendshipsController],
  providers: [FriendshipsService],
  imports: [AchievementsModule],
})
export class FriendshipsModule {}
