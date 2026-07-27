"use client";

import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  Sentry.captureException(error);

  return (
    <html lang="en">
      <body>
        <main>
          <h1>Something went wrong!</h1>
          <button onClick={() => reset()}>Try again</button>
        </main>
      </body>
    </html>
  );
}