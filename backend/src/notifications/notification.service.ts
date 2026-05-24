import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationService');

  sendEmailVerification(email: string, token: string) {
    const link = `http://localhost:3000/verify-email?code=${token}`;
    this.logger.log(
      `\n=== EMAIL para ${email} ===\nVerifica tu correo aquí: ${link}\n`,
    );
  }

  sendPhoneVerification(phone: string, code: string) {
    this.logger.log(
      `\n=== SMS para ${phone} ===\nTu código de verificación es: ${code}\n`,
    );
  }

  sendPasswordResetEmail(email: string, token: string) {
    const link = `http://localhost:3000/reset-password?emailOrPhone=${encodeURIComponent(email)}&code=${token}`;
    this.logger.log(
      `\n=== EMAIL para ${email} ===\nRecupera tu contraseña aquí: ${link}\n`,
    );
  }

  sendPasswordResetPhone(phone: string, code: string) {
    this.logger.log(
      `\n=== SMS para ${phone} ===\nTu código de recuperación es: ${code}\n`,
    );
  }
}
