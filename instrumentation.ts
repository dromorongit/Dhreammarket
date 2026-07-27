import * as Sentry from "@sentry/nextjs";
import { validateEnvironment } from "@/lib/env-validation";

export async function register() {
  validateEnvironment()

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 1.0 : 0,
  });
}