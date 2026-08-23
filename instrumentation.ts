import * as Sentry from "@sentry/nextjs";
import { TracesSamplerSamplingContext } from "@sentry/core";
import { validateEnvironment } from "@/lib/env-validation";

export async function register() {
  validateEnvironment()

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Reduced from 1.0 to 0.1 in production due to a confirmed memory leak from
    // unbounded span/transaction accumulation on the 1GB Railway instance.
    // Long-lived SSE connections keep root spans alive indefinitely, causing
    // continuous memory growth leading to OOM. See tracesSampler below for
    // per-route exclusion of SSE stream endpoints.
    tracesSampler: (context: TracesSamplerSamplingContext) => {
      const isProduction = process.env.NODE_ENV === "production";

      // Disable tracing entirely for long-lived SSE stream routes — these are
      // the worst-case span accumulators since the root span is held open for
      // the entire lifetime of the connection.
      const reqUrl = context.normalizedRequest?.url ?? "";
      if (reqUrl.includes("/stream")) {
        return 0;
      }

      return isProduction ? 0.1 : 0;
    },
    // Cap how long the SDK waits for parent spans to finish before discarding
    // orphaned spans. Available in @sentry/core v10+ via ServerRuntimeOptions.
    // Default is 300s; reduced to 200s to bound worst-case memory growth.
    maxSpanWaitDuration: 200,
  });
}
