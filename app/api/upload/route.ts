import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { UploadRequestSchema } from "@/lib/schema";
import { computeMilestones } from "@/lib/actions/milestones";
import { ParserResponseError, readParserResult } from "@/lib/parser-transport";
import { IncompleteStoredUploadError, persistParsedUpload } from "@/lib/upload-persistence";
import {
  UploadRequestError, isUploadId, parseUploadSize,
  parserHttpErrorMessage, sanitizeUploadFilename,
} from "@/lib/upload-security";

export const maxDuration = 300;
const encoder = new TextEncoder();
const sse = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);

function uploadErrorResponse(message: string, status: number): Response {
  return new Response(sse({ type: "error", msg: message }), {
    status, headers: { "Content-Type": "text/event-stream" },
  });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = sanitizeUploadFilename(searchParams.get("filename"));
  if (!filename) return uploadErrorResponse("Only .txt, .log, and .zip uploads are supported.", 400);

  let declaredFileSize: number;
  try {
    declaredFileSize = parseUploadSize(searchParams.get("fileSize"), "fileSize");
    const contentLength = req.headers.get("content-length");
    if (contentLength !== null) parseUploadSize(contentLength, "Content-Length");
  } catch (error) {
    return error instanceof UploadRequestError
      ? uploadErrorResponse(error.message, error.status)
      : uploadErrorResponse("Invalid upload size.", 400);
  }
  const metadata = UploadRequestSchema.safeParse({
    uploaderName: searchParams.get("uploaderName") ?? undefined,
    guildName: searchParams.get("guildName") ?? undefined,
    realmName: searchParams.get("realmName") ?? "Lordaeron",
    realmHost: searchParams.get("realmHost") ?? "warmane",
    expansion: searchParams.get("expansion") ?? "wotlk",
  });
  if (!metadata.success) return uploadErrorResponse("Invalid upload metadata.", 400);
  const clientUploadId = req.headers.get("x-upload-id");
  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!isUploadId(clientUploadId) || contentType !== "application/octet-stream" || !req.body) {
    return uploadErrorResponse("Invalid streamed upload request.", 400);
  }

  const parserUrl = process.env.PARSER_SERVICE_URL ?? "http://localhost:8000";
  const cancellation = new AbortController();
  const signal = AbortSignal.any([req.signal, cancellation.signal, AbortSignal.timeout(270_000)]);
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try { controller.enqueue(sse(data)); } catch { /* disconnected client */ }
      };
      try {
        let parserResponse: Response;
        try {
          parserResponse = await fetch(`${parserUrl}/uploads/${encodeURIComponent(clientUploadId)}/stream`, {
            method: "POST",
            headers: { "content-type": "application/octet-stream", "x-filename": filename },
            body: req.body,
            duplex: "half", signal,
          } as RequestInit & { duplex: string });
        } catch {
          console.error("[upload] parser request failed", { uploadId: clientUploadId });
          send({ type: "error", msg: "Parser service is unavailable. Please try again shortly." });
          return;
        }
        if (!parserResponse.ok || !parserResponse.body) {
          await parserResponse.body?.cancel().catch(() => undefined);
          send({ type: "error", msg: parserHttpErrorMessage(parserResponse.status) });
          return;
        }
        const parseResult = await readParserResult(parserResponse.body, clientUploadId, send);
        send({ type: "progress", pct: 92, msg: "Saving to database…" });
        const { result, milestoneChecks } = await persistParsedUpload(db, {
          parsed: parseResult, metadata: metadata.data, filename,
          fileSize: parseResult.receivedBytes ?? declaredFileSize,
        });
        if (milestoneChecks.length) {
          send({ type: "progress", pct: 98, msg: "Computing milestones…" });
          try {
            result.milestones = await computeMilestones(milestoneChecks);
          } catch {
            console.error("[upload] milestone computation failed", { uploadId: result.uploadId });
            result.warnings = [...(result.warnings ?? []), "Report saved; milestones are temporarily unavailable."];
          }
        }
        send({ type: "complete", result });
      } catch (error) {
        console.error("[upload] processing failed", {
          uploadId: clientUploadId, category: error instanceof Error ? error.name : "UnknownError",
        });
        send({
          type: "error",
          msg: error instanceof ParserResponseError || error instanceof IncompleteStoredUploadError
            ? error.message : "Upload processing failed. Please try again.",
        });
      } finally {
        try { controller.close(); } catch { /* disconnected client */ }
      }
    },
    cancel() { cancellation.abort(); },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", "X-Upload-ID": clientUploadId,
    },
  });
}
