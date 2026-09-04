import { NextRequest } from "next/server";
import { MAX_PARSER_STATUS_BYTES, readBoundedJson, sanitizeParserStatus } from "@/lib/parser-transport";

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
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      return Response.json(
        { error: response.status === 404 ? "Upload not found." : "Parser status is temporarily unavailable." },
        { status: response.status === 404 ? 404 : 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const payload = await readBoundedJson(response.body, MAX_PARSER_STATUS_BYTES);
    return Response.json(sanitizeParserStatus(payload, uploadId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    console.error("[upload-status] parser request failed", { uploadId });
    return Response.json(
      { error: "Parser status is temporarily unavailable." },
      { status: 503 },
    );
  }
}
