import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { OnModuleDestroy } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PixelCacheService } from './pixel-cache.service';

const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim());

const FLUSH_MS = 150;

type PaintOp = {
  type: 'paint';
  x: number;
  y: number;
  color: string;
  nickname: string | null;
};
type EraseOp = { type: 'erase'; x: number; y: number };
type PendingOp = PaintOp | EraseOp;

@WebSocketGateway({ cors: { origin: allowedOrigins } })
export class PixelGateway implements OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  // Operación final por celda dentro de la ventana de batch. Clave: "x,y".
  private pending = new Map<string, PendingOp>();
  private flushTimer: NodeJS.Timeout | null = null;

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
    this.pending.set(`${x},${y}`, { type: 'paint', x, y, color, nickname });
    this.scheduleFlush();
  }

  broadcastErase(cells: { x: number; y: number }[]) {
    this.pixelCache.deleteMany(cells);
    for (const c of cells) {
      this.pending.set(`${c.x},${c.y}`, { type: 'erase', x: c.x, y: c.y });
    }
    this.scheduleFlush();
  }

  emitToUser(userId: number, payload: unknown) {
    this.server.to(`user:${userId}`).emit('notification', payload);
  }

  onModuleDestroy() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_MS);
  }

  private flush() {
    if (this.pending.size === 0) return;
    const pixels: {
      x: number;
      y: number;
      color: string;
      nickname: string | null;
    }[] = [];
    const erased: { x: number; y: number }[] = [];
    for (const op of this.pending.values()) {
      if (op.type === 'paint') {
        pixels.push({
          x: op.x,
          y: op.y,
          color: op.color,
          nickname: op.nickname,
        });
      } else {
        erased.push({ x: op.x, y: op.y });
      }
    }
    this.pending.clear();
    if (erased.length > 0) this.server.emit('erase', { cells: erased });
    if (pixels.length > 0) this.server.emit('pixel-batch', { pixels });
  }
}
