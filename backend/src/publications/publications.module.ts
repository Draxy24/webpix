import { Module } from '@nestjs/common';
import { PublicationsController } from './publications.controller';
import { PublicationsService } from './publications.service';
import { AchievementsModule } from 'src/achievements/achievements.module';
import { PixelModule } from 'src/pixel/pixel.module';

@Module({
  controllers: [PublicationsController],
  providers: [PublicationsService],
  imports: [AchievementsModule, PixelModule],
})
export class PublicationsModule {}
