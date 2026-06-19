import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { CommunityService } from './community.service';
import { CreateAnnouncementDto } from './dto/community.dto';

@Controller('community')
export class CommunityController {
  constructor(private communityService: CommunityService) {}

  @Get('announcements')
  listAnnouncements() {
    return this.communityService.listAnnouncements();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('announcements')
  createAnnouncement(
    @Request() req: { user: { id: number } },
    @Body() body: CreateAnnouncementDto,
  ) {
    return this.communityService.createAnnouncement(req.user.id, body);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Delete('announcements/:id')
  deleteAnnouncement(@Param('id', ParseIntPipe) id: number) {
    return this.communityService.deleteAnnouncement(id);
  }

  @Get('snapshots')
  listSnapshots() {
    return this.communityService.listSnapshots();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('snapshots/run')
  runSnapshot() {
    return this.communityService.generateCurrentWeekSnapshot();
  }
}
