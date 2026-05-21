import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PublicationsService } from './publications.service';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';

@Controller('publications')
export class PublicationsController {
  constructor(private publicationsService: PublicationsService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(
    @Request() req: { user: { id: number } },
    @Body() body: { title?: string; x1: number; y1: number; x2: number; y2: number },
  ) {
    return this.publicationsService.create(req.user.id, body);
  }

  @Get('user/:nickname')
  listByUser(@Param('nickname') nickname: string) {
    return this.publicationsService.listByUser(nickname);
  }

  @UseGuards(OptionalJwtGuard)
  @Get(':id')
  findById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user?: { id: number } },
  ) {
    return this.publicationsService.findById(id, req.user?.id ?? null);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  delete(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.publicationsService.delete(id, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/react')
  react(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { type: 'LIKE' | 'DISLIKE' },
  ) {
    return this.publicationsService.react(id, req.user.id, body.type);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/comments')
  addComment(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content: string },
  ) {
    return this.publicationsService.addComment(id, req.user.id, body.content);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('comments/:commentId')
  deleteComment(
    @Request() req: { user: { id: number } },
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.publicationsService.deleteComment(commentId, req.user.id);
  }
}
