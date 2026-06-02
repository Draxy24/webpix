import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class PixelGateway {
  @WebSocketServer()
  server: Server;

  broadcastPixel(x: number, y: number, color: string, nickname: string | null) {
    this.server.emit('pixel', { x, y, color, nickname });
  }

  broadcastErase(cells: { x: number; y: number }[]) {
    this.server.emit('erase', { cells });
  }
}
