import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class SeedEnabledGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (process.env.ENABLE_SEED !== 'true') {
      throw new ForbiddenException('Seed deshabilitado');
    }
    return true;
  }
}
