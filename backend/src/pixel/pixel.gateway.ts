import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({ cors: { origin: '*' } })
export class PixelGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(private jwt: JwtService) {}

  handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) return; // anónimo: solo recibe la difusión global
      const payload = this.jwt.verify<{ sub: number }>(token, {
        secret: process.env.JWT_SECRET ?? 'secret_temporal',
      });
      if (payload?.sub) client.join(`user:${payload.sub}`);
    } catch {
      // token ausente o inválido: conexión anónima
    }
  }

  broadcastPixel(x: number, y: number, color: string, nickname: string | null) {
    this.server.emit('pixel', { x, y, color, nickname });
  }

  broadcastErase(cells: { x: number; y: number }[]) {
    this.server.emit('erase', { cells });
  }

  // Empuje a un usuario concreto (lo usarán amistades, likes, ranking…)
  emitToUser(userId: number, payload: unknown) {
    this.server.to(`user:${userId}`).emit('notification', payload);
  }
}
