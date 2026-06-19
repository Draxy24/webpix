import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FriendshipsService } from './friendships.service';
import { SendFriendRequestDto } from './dto/friendships.dto';

@Controller('friendships')
@UseGuards(AuthGuard('jwt'))
export class FriendshipsController {
  constructor(private friendshipsService: FriendshipsService) {}

  @Post()
  send(
    @Request() req: { user: { id: number } },
    @Body() body: SendFriendRequestDto,
  ) {
    return this.friendshipsService.sendRequest(
      req.user.id,
      body.receiverNickname,
    );
  }

  @Get()
  list(@Request() req: { user: { id: number } }) {
    return this.friendshipsService.listFriends(req.user.id);
  }

  @Get('incoming')
  incoming(@Request() req: { user: { id: number } }) {
    return this.friendshipsService.listIncoming(req.user.id);
  }

  @Get('outgoing')
  outgoing(@Request() req: { user: { id: number } }) {
    return this.friendshipsService.listOutgoing(req.user.id);
  }

  @Get('status/:nickname')
  getStatus(
    @Request() req: { user: { id: number } },
    @Param('nickname') nickname: string,
  ) {
    return this.friendshipsService.getStatus(req.user.id, nickname);
  }

  @Patch(':id/accept')
  accept(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipsService.accept(id, req.user.id);
  }

  @Patch(':id/decline')
  decline(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipsService.decline(id, req.user.id);
  }

  @Delete(':id')
  remove(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.friendshipsService.remove(id, req.user.id);
  }
}
