import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ uploadId: string }> },
) {
  const { uploadId } = await context.params;
  if (!UUID_V4.test(uploadId)) {
    return Response.json({ error: "uploadId must be a lowercase UUIDv4" }, { status: 400 });
  }

  const parserUrl = process.env.PARSER_SERVICE_URL ?? "http://localhost:8000";
  try {
    const response = await fetch(`${parserUrl}/uploads/${uploadId}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const payload = await response.json().catch(() => ({ error: "Invalid parser response" }));
    return Response.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: `Parser status unavailable: ${String(error)}` },
      { status: 503 },
    );
  }
}
