import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import twilio from 'twilio';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationService');

  // --- Email (Resend) ---
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;
  private readonly from =
    process.env.RESEND_FROM || 'WebPix <onboarding@resend.dev>';

  // --- SMS (Twilio) ---
  private readonly smsClient =
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      : null;
  private readonly twilioFrom = process.env.TWILIO_PHONE_NUMBER || '';
  private readonly twilioMessagingServiceSid =
    process.env.TWILIO_MESSAGING_SERVICE_SID || '';

  private get frontendUrl(): string {
    return (process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')[0]
      .trim();
  }

  // ===== Email =====

  async sendEmailVerification(email: string, token: string) {
    const link = `${this.frontendUrl}/verify-email?code=${token}`;
    await this.sendEmail({
      to: email,
      subject: 'Verifica tu cuenta de WebPix',
      heading: 'Verifica tu correo',
      body: 'Confirma tu cuenta para empezar a pintar en el lienzo.',
      buttonText: 'Verificar mi cuenta',
      link,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const link = `${this.frontendUrl}/reset-password?emailOrPhone=${encodeURIComponent(
      email,
    )}&code=${token}`;
    await this.sendEmail({
      to: email,
      subject: 'Recupera tu contraseña de WebPix',
      heading: 'Recupera tu contraseña',
      body: 'Pulsa el botón para elegir una nueva contraseña. Si no fuiste tú, ignora este correo.',
      buttonText: 'Restablecer contraseña',
      link,
    });
  }

  // ===== SMS =====

  private readonly verifyServiceSid =
    process.env.TWILIO_VERIFY_SERVICE_SID || '';

  async startPhoneVerification(phone: string) {
    if (!this.smsClient || !this.verifyServiceSid) {
      this.logger.log(`\n=== Verify (stub) ===\nEnviaría OTP a ${phone}\n`);
      return;
    }
    try {
      await this.smsClient.verify.v2
        .services(this.verifyServiceSid)
        .verifications.create({ to: phone, channel: 'sms' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido';
      this.logger.error(`Error iniciando verificación para ${phone}: ${msg}`);
    }
  }

  async checkPhoneVerification(phone: string, code: string): Promise<boolean> {
    if (!this.smsClient || !this.verifyServiceSid) return false;
    try {
      const result = await this.smsClient.verify.v2
        .services(this.verifyServiceSid)
        .verificationChecks.create({ to: phone, code });
      return result.status === 'approved';
    } catch {
      return false; // inválido / expirado / sin verificación pendiente
    }
  }

  async sendSpaceGraceNotice(
    email: string,
    spaceName: string | null,
    graceEndsAt: Date,
  ) {
    const name = spaceName || 'tu espacio privado';
    await this.sendEmail({
      to: email,
      subject: 'Tu espacio privado en WebPix está por liberarse',
      heading: 'No pudimos cobrar la renta',
      body: `No tienes Bits suficientes para renovar "${name}". Tienes hasta el ${graceEndsAt.toLocaleString('es-MX')} para conseguir Bits; si no, el espacio se liberará y sus píxeles volverán a ser públicos.`,
      buttonText: 'Ir a WebPix',
      link: this.frontendUrl,
    });
  }

  async sendSpaceReleasedNotice(email: string, spaceName: string | null) {
    const name = spaceName || 'tu espacio privado';
    await this.sendEmail({
      to: email,
      subject: 'Tu espacio privado en WebPix se liberó',
      heading: 'Espacio liberado',
      body: `"${name}" se liberó por falta de Bits para la renta. Sus píxeles ahora son públicos. Puedes comprar un espacio nuevo cuando quieras.`,
      buttonText: 'Ir a WebPix',
      link: this.frontendUrl,
    });
  }

  async sendWaitlistTurnNotice(email: string) {
    await this.sendEmail({
      to: email,
      subject: 'Tu turno para un espacio privado en WebPix',
      heading: '¡Es tu turno!',
      body: 'Se liberó espacio en el lienzo. Tienes 24 horas para elegir tu zona y completar la compra antes de que el turno pase al siguiente.',
      buttonText: 'Elegir mi espacio',
      link: this.frontendUrl,
    });
  }

  // ===== Helpers =====

  private async sendEmail(opts: {
    to: string;
    subject: string;
    heading: string;
    body: string;
    buttonText: string;
    link: string;
  }) {
    if (!this.resend) {
      this.logger.log(
        `\n=== EMAIL para ${opts.to} ===\n${opts.subject}\n${opts.link}\n`,
      );
      return;
    }
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: opts.to,
        subject: opts.subject,
        html: this.template(
          opts.heading,
          opts.body,
          opts.buttonText,
          opts.link,
        ),
        text: `${opts.body}\n\n${opts.link}`,
      });
      if (error) {
        this.logger.error(`Resend falló para ${opts.to}: ${error.message}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido';
      this.logger.error(`Error enviando email a ${opts.to}: ${msg}`);
    }
  }

  private template(
    heading: string,
    body: string,
    buttonText: string,
    link: string,
  ) {
    return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1a1a1a;">
    <div style="font-size: 22px; font-weight: bold; color: #FF7A1A; margin-bottom: 24px;">WebPix</div>
    <h1 style="font-size: 20px; margin: 0 0 12px;">${heading}</h1>
    <p style="color: #444; line-height: 1.6; margin: 0 0 28px;">${body}</p>
    <a href="${link}" style="display: inline-block; background: #FF7A1A; color: #ffffff; text-decoration: none; font-weight: bold; padding: 12px 28px; border-radius: 8px;">${buttonText}</a>
    <p style="color: #999; font-size: 12px; margin: 28px 0 0; word-break: break-all;">O copia este enlace en tu navegador:<br>${link}</p>
  </div>`;
  }
}
