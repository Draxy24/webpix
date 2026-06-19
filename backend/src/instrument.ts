import 'dotenv/config';
import * as Sentry from '@sentry/nestjs';
import { HttpException } from '@nestjs/common';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Activo solo si hay DSN: en dev no defines SENTRY_DSN y Sentry queda apagado solo.
  enabled: !!process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  // Solo errores, sin trazas de performance, para cuidar la cuota del plan gratis.
  tracesSampleRate: 0,
  // No enviar PII (correos, IPs, teléfonos) automáticamente.
  sendDefaultPii: false,
  // Descarta los 4xx esperados (validación, INSUFFICIENT_BITS, SPACE_CAP_REACHED,
  // INVALID_CODE, etc.). Solo nos interesan los 5xx y las excepciones no controladas.
  beforeSend(event, hint) {
    const ex = hint?.originalException;
    if (ex instanceof HttpException && ex.getStatus() < 500) {
      return null;
    }
    return event;
  },
});
