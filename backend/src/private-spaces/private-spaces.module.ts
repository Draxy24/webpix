import { Module } from '@nestjs/common';
import { PrivateSpacesController } from './private-spaces.controller';
import { PrivateSpacesService } from './private-spaces.service';

@Module({
  controllers: [PrivateSpacesController],
  providers: [PrivateSpacesService],
  exports: [PrivateSpacesService],
})
export class PrivateSpacesModule {}
