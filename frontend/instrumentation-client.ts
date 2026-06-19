import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ac30c468267935f5e29316396410a083@o4511594050224128.ingest.us.sentry.io/4511594121396224",

  // Solo reporta en producción: en dev no ensucia ni gasta cuota.
  enabled: process.env.NODE_ENV === "production",

  // Solo errores, sin performance, para cuidar la cuota del plan gratis.
  tracesSampleRate: 0,

  // Sin logs ni PII (correos, IPs, etc.).
  enableLogs: false,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
