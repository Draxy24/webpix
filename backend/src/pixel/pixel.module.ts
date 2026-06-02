import { Module } from '@nestjs/common';
import { PixelService } from './pixel.service';
import { PixelGateway } from './pixel.gateway';
import { PrivateSpacesModule } from '../private-spaces/private-spaces.module';

@Module({
  imports: [PrivateSpacesModule],
  providers: [PixelService, PixelGateway],
  exports: [PixelService],
})
export class PixelModule {}
