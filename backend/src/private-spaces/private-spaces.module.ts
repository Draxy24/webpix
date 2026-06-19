import { Module } from '@nestjs/common';
import { PrivateSpacesController } from './private-spaces.controller';
import { PrivateSpacesService } from './private-spaces.service';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  controllers: [PrivateSpacesController],
  providers: [PrivateSpacesService],
  exports: [PrivateSpacesService],
  imports: [NotificationModule],
})
export class PrivateSpacesModule {}
