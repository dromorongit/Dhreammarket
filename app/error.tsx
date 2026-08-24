"use client";

import * as Sentry from "@sentry/nextjs";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[Error Boundary]', error.message, error.digest)
  Sentry.captureException(error);

  return (
    <main>
      <h1>Something went wrong!</h1>
      <button onClick={() => reset()}>Try again</button>
    </main>
  );
}