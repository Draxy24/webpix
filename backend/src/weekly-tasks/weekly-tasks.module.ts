import { Module } from '@nestjs/common';
import { WeeklyTasksService } from './weekly-tasks.service';
import { WeeklyTasksController } from './weekly-tasks.controller';
import { RewardsModule } from '../rewards/rewards.module';

@Module({
  imports: [RewardsModule],
  providers: [WeeklyTasksService],
  controllers: [WeeklyTasksController],
  exports: [WeeklyTasksService],
})
export class WeeklyTasksModule {}
