import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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

  @Get('monthly/info')
  monthlyInfo() {
    return this.rankingsService.monthlyInfo();
  }

  @Get('monthly/pixels/global')
  pixelsMonthlyGlobal() {
    return this.rankingsService.pixelsMonthlyGlobal();
  }

  @Get('monthly/pixels/national/:country')
  pixelsMonthlyNational(@Param('country') country: string) {
    return this.rankingsService.pixelsMonthlyNational(country);
  }

  @Get('monthly/creators/global')
  creatorsMonthlyGlobal() {
    return this.rankingsService.creatorsMonthlyGlobal();
  }

  @Get('monthly/creators/national/:country')
  creatorsMonthlyNational(@Param('country') country: string) {
    return this.rankingsService.creatorsMonthlyNational(country);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('admin/close/:period')
  adminClose(
    @Request() req: { user: { id: number } },
    @Param('period') period: string,
  ) {
    return this.rankingsService.adminClose(req.user.id, period);
  }

  @Get('winners/periods')
  closedPeriods() {
    return this.rankingsService.closedPeriods();
  }

  @Get('winners/:period')
  winnersForPeriod(@Param('period') period: string) {
    return this.rankingsService.winnersForPeriod(period);
  }
}
