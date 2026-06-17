import { Module } from '@nestjs/common';
import { ShopService } from './shop.service';
import { ShopController } from './shop.controller';
import { AchievementsModule } from '../achievements/achievements.module';
import { StripeModule } from '../stripe/stripe.module';

@Module({
  imports: [AchievementsModule, StripeModule],
  providers: [ShopService],
  controllers: [ShopController],
  exports: [ShopService],
})
export class ShopModule {}
