import { NextRequest } from "next/server";
import { MAX_PARSER_STATUS_BYTES, readBoundedJson, sanitizeParserStatus } from "@/lib/parser-transport";
import { uploadStatusAdmission } from "@/lib/upload-admission";

export const dynamic = "force-dynamic";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ uploadId: string }> },
) {
  const { uploadId } = await context.params;
  if (!UUID_V4.test(uploadId)) {
    return Response.json({ error: "uploadId must be a lowercase UUIDv4" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const admission = uploadStatusAdmission.acquire();
  if (!admission) {
    return Response.json({ error: "Upload status is busy. Please retry shortly." }, {
      status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }

  const parserUrl = process.env.PARSER_SERVICE_URL ?? "http://localhost:8000";
  try {
    const response = await fetch(`${parserUrl}/uploads/${uploadId}`, {
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(5_000)]), redirect: "error",
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
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    admission.release();
  }
}
