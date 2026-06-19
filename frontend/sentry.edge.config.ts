import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://ac30c468267935f5e29316396410a083@o4511594050224128.ingest.us.sentry.io/4511594121396224",
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0,
  enableLogs: false,
  sendDefaultPii: false,
});
