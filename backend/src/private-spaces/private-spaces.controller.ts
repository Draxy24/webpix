import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotBannedGuard } from '../auth/not-banned.guard';
import { PrivateSpacesService } from './private-spaces.service';
import {
  QuoteSpaceDto,
  PurchaseSpaceDto,
  UpdateAccessDto,
} from './dto/private-spaces.dto';

@Controller('private-spaces')
export class PrivateSpacesController {
  constructor(private service: PrivateSpacesService) {}

  @Get('canvas')
  getCanvas() {
    return this.service.getActiveSpaces();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('quote')
  quote(
    @Body()
    body: QuoteSpaceDto,
  ) {
    return this.service.quote(
      body.x1,
      body.y1,
      body.x2,
      body.y2,
      body.purchaseType,
    );
  }

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Post()
  purchase(
    @Request() req: { user: { id: number } },
    @Body()
    body: PurchaseSpaceDto,
  ) {
    return this.service.purchase(req.user.id, body);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('mine')
  mine(@Request() req: { user: { id: number } }) {
    return this.service.listMine(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Patch(':id/access')
  updateAccess(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: UpdateAccessDto,
  ) {
    return this.service.updateAccess(req.user.id, id, body);
  }

  @UseGuards(AuthGuard('jwt'), NotBannedGuard)
  @Delete(':id')
  release(
    @Request() req: { user: { id: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.release(req.user.id, id);
  }
}
