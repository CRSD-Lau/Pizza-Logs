import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";

/** Render the completed page, including async content below Suspense boundaries. */
export async function renderPage(element: ReactNode | Promise<ReactNode>): Promise<string> {
  const errors: unknown[] = [];
  const stream = await renderToReadableStream(await element, {
    signal: AbortSignal.timeout(15_000),
    onError(error) {
      errors.push(error);
    },
  });
  await stream.allReady;
  if (errors.length > 0) {
    await stream.cancel();
    throw errors.length === 1 ? errors[0] : new AggregateError(errors, "Page rendering failed");
  }
  const markup = await new Response(stream).text();
  if (errors.length > 0) {
    throw errors.length === 1 ? errors[0] : new AggregateError(errors, "Page rendering failed");
  }
  // Match static-render text assertions without React's adjacent-text hydration markers.
  // Keep all content, attributes, Suspense boundaries and error markers intact.
  return markup.replaceAll("<!-- -->", "");
}
