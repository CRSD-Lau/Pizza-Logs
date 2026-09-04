import { z } from "zod";
import { ParseResultSchema, type ParseResult } from "@/lib/schema";
import { MAX_UPLOAD_BYTES, parserEventErrorMessage, publicParserErrorCode } from "@/lib/upload-security";

export const MAX_PARSER_EVENT_BYTES = 64 * 1024 * 1024;
export const MAX_PARSER_RESPONSE_BYTES = 128 * 1024 * 1024;
export const MAX_PARSER_STATUS_BYTES = 8 * 1024 * 1024;

const text = z.string().max(2_048);
const timing = z.number().nonnegative().max(Number.MAX_SAFE_INTEGER);
const timings = z.object({
  networkUploadMs: timing.optional(), archiveValidationMs: timing.optional(),
  quickClassificationMs: timing.optional(), finalByteToQuickResultMs: timing.optional(),
  fullProcessingMs: timing.optional(),
});
const state = z.enum(["uploading", "validating", "classifying", "quick-result-ready", "full-processing", "complete", "error"]);
const quickResult = z.object({
  encounters: z.array(z.object({
    bossName: text, startedAt: text, endedAt: text,
    mode: z.enum(["10N", "10H", "25N", "25H", "UNKNOWN"]),
    confidence: text, evidence: z.array(text).max(1_000), reason: text, detectorVersion: text,
  })).max(10_000),
  archive: z.object({
    format: z.enum(["text", "zip"]), memberName: text,
    compressedBytes: timing, uncompressedBytes: timing,
    memberCount: timing.int(), compressionRatio: timing,
  }).optional(),
});
const progress = z.object({
  type: z.enum(["progress", "state", "quick-result"]),
  pct: z.number().min(0).max(90).optional(),
  state: state.optional(),
  result: quickResult.optional(),
  timings: timings.optional(),
});
const statusSchema = z.object({
  uploadId: z.uuid(), state,
  createdAt: z.iso.datetime({ offset: true }), updatedAt: z.iso.datetime({ offset: true }),
  filename: z.string().max(255).optional(),
  receivedBytes: z.number().int().min(0).max(MAX_UPLOAD_BYTES).optional(),
  encounterCount: z.number().int().min(0).max(10_000).optional(),
  quickResult: quickResult.optional(), timings: timings.optional(),
  errorCode: z.string().max(64).optional(),
});

const messages: Record<string, string> = {
  uploading: "Receiving combat log…", validating: "Validating archive…",
  classifying: "Classifying boss attempts…", "quick-result-ready": "Quick classification ready",
  "full-processing": "Building full reports…",
};

export class ParserResponseError extends Error {
  constructor(message = "Invalid parser response. Please try again.") {
    super(message);
    this.name = "ParserResponseError";
  }
}

export function sanitizeParserStatus(payload: unknown, uploadId: string) {
  const parsed = statusSchema.safeParse(payload);
  if (!parsed.success || parsed.data.uploadId !== uploadId) throw new ParserResponseError();
  const data = parsed.data;
  return {
    ...data,
    ...(data.errorCode ? { errorCode: publicParserErrorCode(data.errorCode) } : {}),
    ...(data.state === "error" ? { error: parserEventErrorMessage(data.errorCode) } : {}),
  };
}

export async function readBoundedJson(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let value = "";
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) throw new ParserResponseError();
      value += decoder.decode(next.value, { stream: true });
    }
    value += decoder.decode();
    return JSON.parse(value);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Consume only a bounded parser protocol; never proxy arbitrary upstream data. */
export async function readParserResult(
  body: ReadableStream<Uint8Array>,
  uploadId: string,
  onProgress: (event: object) => void,
  limits = { eventBytes: MAX_PARSER_EVENT_BYTES, responseBytes: MAX_PARSER_RESPONSE_BYTES },
): Promise<ParseResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let pendingBytes = 0;
  let buffer = "";
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) throw new ParserResponseError("Parser response ended before completion. Please try again.");
      bytes += next.value.byteLength;
      if (bytes > limits.responseBytes) throw new ParserResponseError();
      pendingBytes += next.value.byteLength;
      let searchFrom = Math.max(0, buffer.length - 1);
      buffer += decoder.decode(next.value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf("\n\n", searchFrom)) !== -1) {
        const chunk = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        searchFrom = 0;
        const eventBytes = new TextEncoder().encode(chunk).byteLength;
        pendingBytes -= eventBytes + 2;
        if (eventBytes > limits.eventBytes) throw new ParserResponseError();
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const event: unknown = JSON.parse(line.slice(6));
          if (!event || typeof event !== "object" || !("type" in event)) throw new ParserResponseError();
          const record = event as Record<string, unknown>;
          if (record.type === "done") {
            const parsed = ParseResultSchema.safeParse(record.data);
            if (!parsed.success || (parsed.data.uploadId && parsed.data.uploadId !== uploadId)) throw new ParserResponseError();
            return parsed.data;
          }
          if (record.type === "error") {
            throw new ParserResponseError(parserEventErrorMessage(typeof record.code === "string" ? record.code : undefined));
          }
          const parsed = progress.safeParse(record);
          if (!parsed.success) throw new ParserResponseError();
          onProgress({
            ...parsed.data, uploadId,
            msg: messages[parsed.data.state ?? ""] ?? "Parser reading combat events…",
          });
        }
      }
      if (pendingBytes > limits.eventBytes) throw new ParserResponseError();
    }
  } catch (error) {
    if (error instanceof ParserResponseError) throw error;
    throw new ParserResponseError();
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
