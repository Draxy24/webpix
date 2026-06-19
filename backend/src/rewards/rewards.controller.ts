import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RewardsService } from './rewards.service';
import { AdminGuard } from '../auth/admin.guard';
import { SeedEnabledGuard } from '../auth/seed-enabled.guard';
import { CosmeticDto } from './dto/rewards.dto';

@Controller('rewards')
export class RewardsController {
  constructor(private rewardsService: RewardsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Request() req: { user: { id: number } }) {
    return this.rewardsService.getProgression(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('cosmetics')
  myCosmetics(@Request() req: { user: { id: number } }) {
    return this.rewardsService.listMyCosmetics(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('equip')
  equip(@Request() req: { user: { id: number } }, @Body() body: CosmeticDto) {
    return this.rewardsService.equip(req.user.id, body.cosmeticId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('unequip')
  unequip(@Request() req: { user: { id: number } }, @Body() body: CosmeticDto) {
    return this.rewardsService.unequip(req.user.id, body.cosmeticId);
  }

  // Temporal (dev): siembra catálogo + datos de prueba. Quitar/restringir antes del lanzamiento.
  @UseGuards(AuthGuard('jwt'), AdminGuard, SeedEnabledGuard)
  @Post('admin/seed')
  seed(@Request() req: { user: { id: number } }) {
    return this.rewardsService.seedAndGrant(req.user.id);
  }
}
