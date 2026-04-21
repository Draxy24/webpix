import { Controller, Get, Post, Body } from '@nestjs/common';

const pixels: Record<string, string> = {};

@Controller()
export class AppController {
  @Get('pixels')
  getPixels() {
    return pixels;
  }

  @Post('pixel')
  setPixel(@Body() body: { x: number; y: number; color: string }) {
    const key = `${body.x},${body.y}`;
    pixels[key] = body.color;

    return { success: true };
  }
}
