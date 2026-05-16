import { Module } from '@nestjs/common';
import { PixelService } from './pixel.service';
import { PixelGateway } from './pixel.gateway';

@Module({
  providers: [PixelService, PixelGateway],
  exports: [PixelService],
})
export class PixelModule {}