import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PublicationsService } from './publications.service';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { NotBannedGuard } from '../auth/not-banned.guard';
import {
  CreatePublicationDto,
  ReactDto,
  AddCommentDto,
} from './dto/publications.dto';

@Controller('publications')
export class PublicationsController {
  constructor(private publicationsService: PublicationsService) {}

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Post()
  create(
    @Request() req: { user: { id: number } },
    @Body()
    body: CreatePublicationDto,
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

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Delete(':id')
  delete(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.publicationsService.delete(id, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Post(':id/react')
  react(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ReactDto,
  ) {
    return this.publicationsService.react(id, req.user.id, body.type);
  }

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Post(':id/comments')
  addComment(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddCommentDto,
  ) {
    return this.publicationsService.addComment(id, req.user.id, body.content);
  }

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Delete('comments/:commentId')
  deleteComment(
    @Request() req: { user: { id: number } },
    @Param('commentId', ParseIntPipe) commentId: number,
  ) {
    return this.publicationsService.deleteComment(commentId, req.user.id);
  }
}
