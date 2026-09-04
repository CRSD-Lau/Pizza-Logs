import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const parserUrl = process.env.PARSER_SERVICE_URL ?? "http://localhost:8000";
  const checks = await Promise.allSettled([
    db.$queryRaw`SELECT 1`,
    fetch(`${parserUrl}/ready`, { signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "error" })
      .then(async response => { await response.body?.cancel(); if (!response.ok) throw new Error("Unavailable"); }),
  ]);
  const ready = checks.every(result => result.status === "fulfilled");
  return Response.json({ status: ready ? "ready" : "unavailable" }, {
    status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" },
  });
}
