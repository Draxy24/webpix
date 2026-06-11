import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../auth/admin.guard';
import { NotBannedGuard } from '../auth/not-banned.guard';
import { ModerationService } from './moderation.service';

@Controller()
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Post('reports')
  createReport(
    @Request() req: { user: { id: number } },
    @Body()
    body: {
      type: 'USER' | 'PUBLICATION' | 'COMMENT' | 'BUG' | 'CANVAS';
      targetUserId?: number;
      targetNickname?: string;
      publicationId?: number;
      commentId?: number;
      x1?: number;
      y1?: number;
      x2?: number;
      y2?: number;
      reason: string;
      details?: string;
    },
  ) {
    return this.moderationService.createReport(req.user.id, body);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('moderation/reports')
  listReports(@Query('status') status?: string, @Query('type') type?: string) {
    return this.moderationService.listReports(status, type);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Patch('moderation/reports/:id/resolve')
  resolveReport(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderationService.resolveReport(id, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Patch('moderation/reports/:id/dismiss')
  dismissReport(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderationService.dismissReport(id, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('moderation/ban')
  banUser(
    @Request() req: { user: { id: number } },
    @Body()
    body: { userId: number; durationDays?: number | null; reason: string },
  ) {
    return this.moderationService.banUser(
      req.user.id,
      body.userId,
      body.durationDays ?? null,
      body.reason,
    );
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Patch('moderation/ban/:userId')
  modifyBan(
    @Request() req: { user: { id: number } },
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { durationDays?: number | null },
  ) {
    return this.moderationService.modifyBan(
      req.user.id,
      userId,
      body.durationDays ?? null,
    );
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('moderation/unban/:userId')
  unbanUser(
    @Request() req: { user: { id: number } },
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.moderationService.unbanUser(req.user.id, userId);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Delete('moderation/publication/:id')
  deletePublication(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderationService.deletePublication(req.user.id, id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Delete('moderation/comment/:id')
  deleteComment(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moderationService.deleteComment(req.user.id, id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('moderation/log')
  getLog() {
    return this.moderationService.getModerationLog();
  }
}
