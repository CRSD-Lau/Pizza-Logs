import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { UPLOAD_POLICY_HEADER, UPLOAD_POLICY_VERSION } from "../lib/upload-policy.ts";
import { localTestBase } from "./e2e-upload.mjs";

// This creates and uploads only a public synthetic benchmark fixture to the
// isolated loopback stack. The live site is never an allowed destination.
const base = localTestBase(process.env.PIZZA_TEST_BASE_URL ?? "http://127.0.0.1:3000");
const repository = fileURLToPath(new URL("..", import.meta.url));
const temporaryRoot = path.resolve(os.tmpdir());
const temporaryPrefix = "pizza-upload-limit-e2e-";
const temporaryDirectory = await fs.mkdtemp(path.join(temporaryRoot, temporaryPrefix));
const filename = "synthetic-upload-over-100-mib.txt";
const inputPath = path.join(temporaryDirectory, filename);

try {
  const generated = spawnSync(process.env.PARSER_CONTRACT_PYTHON ?? "python", ["-c", `
import json, shutil, sys, zipfile
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / "parser" / "benchmarks"))
from benchmark_archive_upload import generate_fixture
directory = Path(sys.argv[1])
archive_path = directory / "synthetic-benchmark.zip"
attempts = generate_fixture(archive_path, 35 * 1024 * 1024)
with zipfile.ZipFile(archive_path) as archive:
    members = archive.infolist()
    assert len(members) == 1 and members[0].filename == "WoWCombatLog.TXT"
    assert 100 * 1024 * 1024 < members[0].file_size <= 1024 ** 3
    with archive.open(members[0]) as source, (directory / sys.argv[2]).open("wb") as target:
        shutil.copyfileobj(source, target, 1024 * 1024)
print(json.dumps({"attempts": attempts, "compressedBytes": archive_path.stat().st_size}))
`, temporaryDirectory, filename], {
    cwd: repository,
    shell: false,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 1024 * 1024,
  });
  assert.equal(generated.status, 0, `Python must generate the synthetic fixture: ${generated.error?.message ?? generated.stderr}`);
  const fixture = JSON.parse(generated.stdout);
  assert.equal(fixture.attempts, 120, "The benchmark must retain its expected attempt count");
  const { size } = await fs.stat(inputPath);
  assert.ok(size > 100 * 1024 * 1024, "Actual uploaded bytes must exceed the previous 100 MiB ceiling");
  assert.ok(size <= 1024 ** 3, "The generated log must fit the 1 GiB upload ceiling");

  const clientUploadId = randomUUID();
  const parameters = new URLSearchParams({
    filename,
    fileSize: String(size),
    uploaderName: "Synthetic Limit Test",
    guildName: "Synthetic Upload Limit Audit",
  });
  const started = performance.now();
  const stream = createReadStream(inputPath);
  let result;
  try {
    const response = await fetch(new URL(`/api/upload?${parameters}`, base), {
      method: "POST",
      body: stream,
      duplex: "half",
      redirect: "error",
      signal: AbortSignal.timeout(270_000),
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(size),
        "x-upload-id": clientUploadId,
        [UPLOAD_POLICY_HEADER]: UPLOAD_POLICY_VERSION,
      },
    });
    assert.equal(response.status, 200, "The web route must admit an actual upload larger than 100 MiB");
    const events = (await response.text()).split("\n")
      .filter(line => line.startsWith("data: "))
      .map(line => JSON.parse(line.slice(6)));
    const errors = events.filter(event => event.type === "error");
    assert.deepEqual(errors, [], `Large upload must not fail: ${JSON.stringify(errors)}`);
    const complete = events.filter(event => event.type === "complete");
    assert.equal(complete.length, 1, "The upload must finish parsing and persist exactly once");
    result = complete[0].result;
    assert.equal(result.status, "DONE");
    assert.equal(result.encountersFound, fixture.attempts);
    assert.equal(result.encountersInserted, fixture.attempts);
    assert.equal(result.encountersDuplicate, 0);
  } finally {
    stream.destroy();
    await finished(stream).catch(() => undefined);
  }

  // Read the parser's actual receipt through the public status proxy. A DONE
  // result additionally proves the route's byte reconciliation and DB write.
  const statusResponse = await fetch(new URL(`/api/upload/status/${clientUploadId}`, base), {
    redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  assert.equal(statusResponse.status, 200);
  const receipt = await statusResponse.json();
  assert.equal(receipt.state, "complete");
  assert.equal(receipt.receivedBytes, size, "Parser-observed bytes must match the actual streamed file");
  assert.equal(receipt.encounterCount, fixture.attempts);
  assert.ok(result.publicReportSlug && result.firstSessionSlug, "A persisted session route must be returned");
  const reportPath = `/raids/${encodeURIComponent(result.publicReportSlug)}/sessions/${encodeURIComponent(result.firstSessionSlug)}`;
  const reportResponse = await fetch(new URL(reportPath, base), {
    redirect: "error", signal: AbortSignal.timeout(30_000),
  });
  assert.equal(reportResponse.status, 200, "The stored report must render successfully");
  await reportResponse.body?.cancel();

  const summary = {
    author: "Neil Mitchell",
    lastModifiedBy: "Neil Mitchell",
    check: "Actual upload above 100 MiB through web, parser and database",
    status: "pass",
    uploadedBytes: size,
    parserReceivedBytes: receipt.receivedBytes,
    encountersFound: result.encountersFound,
    encountersInserted: result.encountersInserted,
    reportPath,
    durationMs: Math.round(performance.now() - started),
  };
  const outputDirectory = path.join(repository, ".test-artifacts", "upload-limit");
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(path.join(outputDirectory, "e2e.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  // Only remove the exact temporary directory allocated by this invocation.
  const cleanupPath = path.resolve(temporaryDirectory);
  assert.equal(path.dirname(cleanupPath), temporaryRoot);
  assert.ok(path.basename(cleanupPath).startsWith(temporaryPrefix));
  await fs.rm(cleanupPath, { recursive: true, force: true });
}
