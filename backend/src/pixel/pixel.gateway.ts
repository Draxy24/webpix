import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PixelCacheService } from './pixel-cache.service';

const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim());

@WebSocketGateway({ cors: { origin: allowedOrigins } })
export class PixelGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private pixelCache: PixelCacheService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return; // anónimo: solo recibe la difusión global
      const payload = this.jwt.verify<{ sub: number }>(token, {
        secret: process.env.JWT_SECRET!,
      });
      if (payload?.sub) client.join(`user:${payload.sub}`);
    } catch {
      // token ausente o inválido: conexión anónima
    }
  }

  broadcastPixel(x: number, y: number, color: string, nickname: string | null) {
    this.pixelCache.set(x, y, color, nickname);
    this.server.emit('pixel', { x, y, color, nickname });
  }

  broadcastErase(cells: { x: number; y: number }[]) {
    this.pixelCache.deleteMany(cells);
    this.server.emit('erase', { cells });
  }

  emitToUser(userId: number, payload: unknown) {
    this.server.to(`user:${userId}`).emit('notification', payload);
  }
}
