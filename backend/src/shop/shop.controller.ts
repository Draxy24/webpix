import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ShopService } from './shop.service';

@Controller('shop')
export class ShopController {
  constructor(private shop: ShopService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  list(@Request() req: { user: { id: number } }) {
    return this.shop.listForUser(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('buy')
  buy(
    @Request() req: { user: { id: number } },
    @Body() body: { cosmeticId: number },
  ) {
    return this.shop.buy(req.user.id, body.cosmeticId);
  }

  // Temporal (dev): siembra el catálogo de la tienda. Quitar/restringir antes del lanzamiento.
  @UseGuards(AuthGuard('jwt'))
  @Post('admin/seed')
  seed(@Request() req: { user: { id: number } }) {
    return this.shop.seedCatalog(req.user.id);
  }
}
