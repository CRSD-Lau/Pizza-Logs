import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const uploadZone = fs.readFileSync(path.join(root, "components/upload/UploadZone.tsx"), "utf8");
const uploadRoute = fs.readFileSync(path.join(root, "app/api/upload/route.ts"), "utf8");
const uploadPersistence = fs.readFileSync(path.join(root, "lib/upload-persistence.ts"), "utf8");
const statusRoute = fs.readFileSync(
  path.join(root, "app/api/upload/status/[uploadId]/route.ts"),
  "utf8",
);

assert.match(uploadZone, /crypto\.randomUUID\(\)/, "browser must create a random upload ID");
assert.match(uploadZone, /application\/octet-stream/, "browser must use the raw streamed protocol");
assert.match(uploadZone, /application\/zip/, "ZIP archives must be selectable");
assert.match(uploadZone, /quick-result/, "quick classification must be visible before full completion");
assert.doesNotMatch(uploadZone, /new FormData\(/, "new upload path must not rebuild multipart bodies");

assert.match(uploadRoute, /\/uploads\/\$\{encodeURIComponent\(clientUploadId\)\}\/stream/);
assert.match(uploadRoute, /body:\s+req\.body/, "Next.js must forward the request stream directly");
assert.doesNotMatch(uploadRoute, /\/parse-stream/, "public uploads must not fall back to the legacy parser path");
assert.match(uploadRoute, /parseResult\.receivedBytes \?\? declaredFileSize/, "stored size should use parser-observed bytes");
assert.match(uploadRoute, /X-Upload-ID/, "upload response must expose the upload ID");
assert.match(
  uploadPersistence,
  /enc\.outcome === "KILL" && enc\.difficulty !== "UNKNOWN"/,
  "UNKNOWN attempts must not create ranking milestones",
);
assert.match(statusRoute, /\/uploads\/\$\{uploadId\}/, "status route must proxy the parser state endpoint");

console.log("archive upload source contract tests passed");
