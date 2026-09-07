export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SAFE_PARSER_ERRORS: Readonly<Record<string, string>> = {
  INVALID_ARCHIVE: "The ZIP archive is damaged or unreadable.",
  NO_USABLE_COMBAT_LOG: "The upload does not contain a usable combat log.",
  UNSUPPORTED_FORMAT: "Only .txt, .log, and .zip uploads are supported.",
  EMPTY_UPLOAD: "The uploaded file is empty.",
  COMPRESSED_SIZE_LIMIT: "File exceeds the 100 MiB compressed upload limit.",
  MAGIC_MISMATCH: "The file contents do not match the filename extension.",
  MEMBER_COUNT_LIMIT: "The archive contains too many files.",
  UNSAFE_MEMBER_PATH: "The archive contains an unsafe file path.",
  NESTED_ARCHIVE: "Nested archives are not accepted.",
  ENCRYPTED_ARCHIVE: "Encrypted archives are not accepted.",
  SYMLINK_MEMBER: "Archive symlinks are not accepted.",
  COMPRESSION_RATIO_LIMIT: "The archive exceeds the compression-ratio limit.",
  UNCOMPRESSED_SIZE_LIMIT: "The archive expands beyond the allowed size.",
  PROCESSING_TIMEOUT: "Upload processing timed out. Please try again.",
  LINE_LENGTH_LIMIT: "A combat-log line exceeds the supported length.",
  ARCHIVE_METADATA_LIMIT: "The ZIP directory metadata exceeds the supported limit.",
  DUPLICATE_MEMBER: "The archive contains duplicate file names.",
  UNSUPPORTED_COMPRESSION: "ZIP members must use stored or deflate compression.",
  UNSUPPORTED_ARCHIVE_MEMBER: "The ZIP must contain only one .txt or .log combat log and folders.",
  MULTIPLE_COMBAT_LOGS: "Upload one combat log at a time.",
  INVALID_TEXT_ENCODING: "The combat log uses an unsupported text encoding.",
  INVALID_TEXT_CONTENT: "The upload contains binary data or unsupported control characters.",
  INVALID_LOG_CONTENT: "The upload contains malformed or unrecognized combat-log records. Finish recording and upload the unmodified log.",
  LOG_COMPLEXITY_LIMIT: "The combat log exceeds the supported processing limits. Upload a shorter log.",
  UPLOAD_CANCELLED: "The upload was cancelled. Please try again.",
};

export class UploadRequestError extends Error {
  constructor(message: string, readonly status: number = 400) {
    super(message);
    this.name = "UploadRequestError";
  }
}

export function parseUploadSize(value: string | null, field: string): number {
  if (value === null || !/^\d+$/.test(value)) {
    throw new UploadRequestError(`${field} must be a non-negative integer.`);
  }

  const size = Number(value);
  if (!Number.isSafeInteger(size)) {
    throw new UploadRequestError(`${field} is outside the supported range.`);
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new UploadRequestError("File exceeds the 100 MiB compressed upload limit.", 413);
  }
  return size;
}

export function sanitizeUploadFilename(value: string | null): string | null {
  const filename = value?.split(/[\\/]/).pop()?.trim();
  if (!filename || filename.length > 255 || /[\u0000-\u001f\u007f]/.test(filename)) {
    return null;
  }
  return /\.(?:txt|log|zip)$/i.test(filename) ? filename : null;
}

export function isUploadId(value: string | null): value is string {
  return value !== null && UPLOAD_ID_PATTERN.test(value);
}

/** Browsers must use the configured site; explicit-policy CLI uploads remain supported. */
export function hasTrustedUploadOrigin(headers: Headers): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "none"].includes(fetchSite)) return false;
  const origin = headers.get("origin");
  if (origin === null) return true;
  if (origin === "null") return false;
  try {
    const configured = process.env.ADMIN_AUTH_URL;
    if (configured) return origin === new URL(configured).origin;
    const url = new URL(origin);
    return process.env.NODE_ENV !== "production" && origin === url.origin
      && ["http:", "https:"].includes(url.protocol)
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function parserHttpErrorMessage(status: number): string {
  if (status === 400) return "The parser rejected the upload as invalid.";
  if (status === 408) return "Upload processing timed out. Please try again.";
  if (status === 409) return "The upload identifier is already in use. Please retry.";
  if (status === 413) return "File exceeds the 100 MiB compressed upload limit.";
  if (status === 429) return "Upload capacity is busy. Please retry shortly.";
  return "The parser could not process this upload. Please try again.";
}

export function parserEventErrorMessage(code: string | undefined): string {
  return code && Object.hasOwn(SAFE_PARSER_ERRORS, code)
    ? SAFE_PARSER_ERRORS[code]
    : "Upload processing failed. Please try again.";
}

export function publicParserErrorCode(code: string | undefined): string {
  return code && Object.hasOwn(SAFE_PARSER_ERRORS, code) ? code : "PROCESSING_ERROR";
}
