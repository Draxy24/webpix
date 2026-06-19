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
import { AdminGuard } from '../auth/admin.guard';
import { SeedEnabledGuard } from '../auth/seed-enabled.guard';
import {
  BuyDto,
  BuyPaletteDto,
  BuyBitsDto,
  SubscribeDto,
} from './dto/shop.dto';

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
  buy(@Request() req: { user: { id: number } }, @Body() body: BuyDto) {
    return this.shop.buy(req.user.id, body.cosmeticId);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard, SeedEnabledGuard)
  @Post('admin/seed')
  seed(@Request() req: { user: { id: number } }) {
    return this.shop.seedCatalog(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('palettes')
  listPalettes(@Request() req: { user: { id: number } }) {
    return this.shop.listPalettesForUser(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('buy-palette')
  buyPalette(
    @Request() req: { user: { id: number } },
    @Body() body: BuyPaletteDto,
  ) {
    return this.shop.buyPalette(req.user.id, body.paletteKey);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('bit-packages')
  bitPackages() {
    return this.shop.listBitPackages();
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('buy-bits')
  buyBits(@Request() req: { user: { id: number } }, @Body() body: BuyBitsDto) {
    return this.shop.buyBits(req.user.id, body.packageKey);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('subscribe')
  subscribe(
    @Request() req: { user: { id: number } },
    @Body() body: SubscribeDto,
  ) {
    return this.shop.subscribe(req.user.id, body.tier);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('billing-portal')
  billingPortal(@Request() req: { user: { id: number } }) {
    return this.shop.billingPortal(req.user.id);
  }
}
