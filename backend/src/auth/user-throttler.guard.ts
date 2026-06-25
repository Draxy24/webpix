import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  // Define la "llave" del rate limit: por usuario si hay sesión, por IP si es anónimo.
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = req.user?.id;
    if (userId != null) return `user:${userId}`;
    return `ip:${req.ip}`;
  }
}
