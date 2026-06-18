import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AchievementsService } from './achievements.service';
import { AdminGuard } from '../auth/admin.guard';
import { SeedEnabledGuard } from '../auth/seed-enabled.guard';

@Controller('achievements')
export class AchievementsController {
  constructor(private achievements: AchievementsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  myAchievements(@Request() req: { user: { id: number } }) {
    return this.achievements.listForUser(req.user.id);
  }

  // Temporal (dev): siembra el catálogo de logros. Quitar/restringir antes del lanzamiento.
  @UseGuards(AuthGuard('jwt'), AdminGuard, SeedEnabledGuard)
  @Post('admin/seed')
  seed(@Request() req: { user: { id: number } }) {
    return this.achievements.seedCatalog(req.user.id);
  }
}
