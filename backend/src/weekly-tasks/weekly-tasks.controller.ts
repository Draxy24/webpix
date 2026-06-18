import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WeeklyTasksService } from './weekly-tasks.service';
import { AdminGuard } from '../auth/admin.guard';
import { SeedEnabledGuard } from '../auth/seed-enabled.guard';

@Controller('weekly-tasks')
export class WeeklyTasksController {
  constructor(private weeklyTasks: WeeklyTasksService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  myTasks(@Request() req: { user: { id: number } }) {
    return this.weeklyTasks.listForUser(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard, SeedEnabledGuard)
  @Post('admin/seed')
  seed(@Request() req: { user: { id: number } }) {
    return this.weeklyTasks.seedCatalog(req.user.id);
  }
}
