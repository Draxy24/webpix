import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  // Si despliegas detrás de un proxy/balanceador (nginx, Cloudflare, Railway, Render...),
  // pon TRUST_PROXY=true para que el rate limiter vea la IP real del cliente y no la del
  // proxy. NO lo actives si el server queda expuesto directo (permitiría falsear la IP).
  if (process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
  }

  // Cabeceras de seguridad. crossOriginResourcePolicy en 'cross-origin' para que el
  // frontend (otro origen) pueda seguir cargando las imágenes servidas desde public/.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  app.useStaticAssets(join(process.cwd(), 'public'));

  // CORS restringido. FRONTEND_URL admite varios orígenes separados por coma,
  // p. ej. "https://webpix.art,http://localhost:3000".
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({ origin: allowedOrigins, credentials: true });

  await app.listen(3001);
}
bootstrap();
