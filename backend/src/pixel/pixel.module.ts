import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PixelService } from './pixel.service';
import { PixelGateway } from './pixel.gateway';
import { PrivateSpacesModule } from '../private-spaces/private-spaces.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [
    PrivateSpacesModule,
    AchievementsModule,
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'secret_temporal' }),
  ],
  providers: [PixelService, PixelGateway],
  exports: [PixelService, PixelGateway],
})
export class PixelModule {}
