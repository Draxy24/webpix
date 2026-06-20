import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PixelService } from './pixel.service';
import { PixelGateway } from './pixel.gateway';
import { PixelCacheService } from './pixel-cache.service';
import { PrivateSpacesModule } from '../private-spaces/private-spaces.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [
    PrivateSpacesModule,
    AchievementsModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('JWT_SECRET no está definido en el entorno');
        }
        return { secret };
      },
    }),
  ],
  providers: [PixelService, PixelGateway, PixelCacheService],
  exports: [PixelService, PixelGateway, PixelCacheService],
})
export class PixelModule {}
