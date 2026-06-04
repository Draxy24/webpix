import { Module } from '@nestjs/common';
import { PublicationsController } from './publications.controller';
import { PublicationsService } from './publications.service';
import { AchievementsModule } from 'src/achievements/achievements.module';

@Module({
  controllers: [PublicationsController],
  providers: [PublicationsService],
  imports: [AchievementsModule],
})
export class PublicationsModule {}
