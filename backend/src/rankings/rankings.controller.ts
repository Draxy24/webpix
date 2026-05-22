import { Controller, Get, Param } from '@nestjs/common';
import { RankingsService } from './rankings.service';

@Controller('rankings')
export class RankingsController {
  constructor(private rankingsService: RankingsService) {}

  @Get('pixels/global')
  pixelsGlobal() {
    return this.rankingsService.pixelsGlobal();
  }

  @Get('pixels/national/:country')
  pixelsNational(@Param('country') country: string) {
    return this.rankingsService.pixelsNational(country);
  }

  @Get('creators/global')
  creatorsGlobal() {
    return this.rankingsService.creatorsGlobal();
  }

  @Get('creators/national/:country')
  creatorsNational(@Param('country') country: string) {
    return this.rankingsService.creatorsNational(country);
  }
}
