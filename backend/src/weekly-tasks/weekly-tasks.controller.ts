import { Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WeeklyTasksService } from './weekly-tasks.service';

@Controller('weekly-tasks')
export class WeeklyTasksController {
  constructor(private weeklyTasks: WeeklyTasksService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  myTasks(@Request() req: { user: { id: number } }) {
    return this.weeklyTasks.listForUser(req.user.id);
  }

  // Temporal (dev): siembra el catálogo de tareas. Quitar/restringir antes del lanzamiento.
  @UseGuards(AuthGuard('jwt'))
  @Post('admin/seed')
  seed(@Request() req: { user: { id: number } }) {
    return this.weeklyTasks.seedCatalog(req.user.id);
  }
}
