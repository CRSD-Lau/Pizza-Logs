import assert from "node:assert/strict";
import {
  MAX_UPLOAD_BYTES,
  UploadRequestError,
  isUploadId,
  parseUploadSize,
  parserEventErrorMessage,
  parserHttpErrorMessage,
  sanitizeUploadFilename,
} from "../lib/upload-security";

assert.equal(parseUploadSize("0", "fileSize"), 0);
assert.equal(parseUploadSize(String(MAX_UPLOAD_BYTES), "fileSize"), MAX_UPLOAD_BYTES);
assert.throws(() => parseUploadSize("-1", "fileSize"), UploadRequestError);
assert.throws(() => parseUploadSize("1.5", "fileSize"), UploadRequestError);
assert.throws(
  () => parseUploadSize(String(MAX_UPLOAD_BYTES + 1), "fileSize"),
  (error: unknown) => error instanceof UploadRequestError && error.status === 413,
);

assert.equal(sanitizeUploadFilename("C:\\Logs\\WoWCombatLog.txt"), "WoWCombatLog.txt");
assert.equal(sanitizeUploadFilename("raid.zip"), "raid.zip");
assert.equal(sanitizeUploadFilename("payload.exe"), null);
assert.equal(sanitizeUploadFilename("bad\nname.txt"), null);

assert.equal(isUploadId("01234567-89ab-4cde-8f01-23456789abcd"), true);
assert.equal(isUploadId("01234567-89ab-1cde-8f01-23456789abcd"), false);
assert.equal(isUploadId("../../tmp/file"), false);

assert.equal(parserHttpErrorMessage(413), "File exceeds the 100 MiB compressed upload limit.");
assert.equal(parserHttpErrorMessage(500), "The parser could not process this upload. Please try again.");
assert.equal(parserEventErrorMessage("INVALID_ARCHIVE"), "The ZIP archive is damaged or unreadable.");
assert.equal(parserEventErrorMessage("INTERNAL_DATABASE_PATH"), "Upload processing failed. Please try again.");
assert.equal(parserEventErrorMessage("toString"), "Upload processing failed. Please try again.");
assert.equal(parserEventErrorMessage("constructor"), "Upload processing failed. Please try again.");
assert.equal(parserEventErrorMessage("__proto__"), "Upload processing failed. Please try again.");

console.log("upload security tests passed");
