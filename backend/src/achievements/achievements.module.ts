import { Module } from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';
import { RewardsModule } from '../rewards/rewards.module';
import { WeeklyTasksModule } from '../weekly-tasks/weekly-tasks.module';

@Module({
  imports: [RewardsModule, WeeklyTasksModule],
  providers: [AchievementsService],
  controllers: [AchievementsController],
  exports: [AchievementsService],
})
export class AchievementsModule {}
