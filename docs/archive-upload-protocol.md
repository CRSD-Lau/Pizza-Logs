# Streamed Upload Protocol

The public upload path sends one bounded raw-byte request and receives Server-Sent Events. It does not buffer the whole archive in the browser or Next.js process.

## Browser to Web

```http
POST /api/upload?filename=raid.zip&fileSize=31621979&uploaderName=Name
Content-Type: application/octet-stream
X-Upload-ID: <lowercase UUIDv4 from crypto.randomUUID()>
X-Upload-Policy-Version: 2026-09-06

<raw file bytes>
```

The current policy version is defined in `lib/upload-policy.ts`. Missing/stale acknowledgement returns 428 before reading the body or contacting the parser/database. This is a per-request acknowledgement, not an authenticated identity or durable consent record. The browser starts unchecked and resets acceptance for every new upload. Older open tabs must reload after a policy-version change; API clients must deliberately supply the current version.

Browser `Origin` must match the trusted `ADMIN_AUTH_URL` origin; cross-site/same-site Fetch Metadata is rejected. Missing Origin is allowed for non-browser clients carrying the policy header. Development permits loopback origins without configured auth; production browsers fail closed without a trusted origin. Host and forwarded-IP headers do not establish trust.

The web route sanitizes the base filename, validates declared/content length against the 100 MiB ceiling, validates visible-text metadata, and requires a UUIDv4 plus octet-stream body. HTTP content encodings other than identity are rejected. Actual streamed bytes must exactly match the declared size and parser receipt before persistence. The stream retains backpressure; it is not buffered in memory. The web admits four active requests and 12 starts per 60 seconds per process, including failed admitted attempts, and returns 429 with `Retry-After: 60` when busy. It does not expose parser exception text.

## Web to Parser

```http
POST /uploads/<upload-id>/stream
Content-Type: application/octet-stream
X-Filename: raid.zip

<forwarded request stream>
```

The parser generates an independent random file token and writes only `<server-token>.part` inside its upload directory while calculating SHA-256 and counting received bytes. It flushes/fsyncs and atomically renames to `<server-token>.upload` after the final byte. Request identifiers and filenames never determine filesystem paths. A reused upload ID returns 409.

The temporary file and admission slot remain owned until every underlying worker has stopped, including after timeout or client disconnect. Queued work is cancelled; running workers receive cooperative cancellation. Body cancellation and a connection failure before SSE starts also finalize ownership. Abandoned `.part`/`.upload` files are cleaned after the configured retention window when upload cleanup runs; active files are excluded.

Python threads cannot be forcibly killed safely. A worker inside non-interruptible aggregation can retain a slot beyond the response timeout until it exits. This prevents new uploads from bypassing capacity, but it does not promise a hard CPU deadline. Process isolation is required for a hard execution limit.

Upload and status proxy requests reject upstream redirects. The configured parser destination must stay on private service networking; it is not taken from uploaded metadata.

## States

```text
uploading -> validating -> classifying -> quick-result-ready
          -> full-processing -> complete | error
```

The browser knows the ID before transfer. Parser state is available through `GET /uploads/<upload-id>` and the web proxy `GET /api/upload/status/<upload-id>` while the ephemeral state remains in memory. Retained states have a count limit; older terminal states are evicted first. A missing state requires a fresh upload and does not establish whether persistence succeeded. State and files are not a durable job queue and cannot survive a parser restart reliably.

`quick-result` contains attempt segmentation/difficulty only. It is not a stored report and does not mean full parsing is complete. The final `done` event contains validated encounters, warnings, SHA-256, parser-observed `receivedBytes`, session analytics, and timing fields.

New results also contain `provenance`: parser version, metric schema version, analytical profile, reference SHA and UTC parse timestamp. The current `canonical-v1` profile has a null reference SHA: inspecting UwU source does not establish compatible output. Historical results without provenance remain unknown.

## Web Validation and Persistence

The web service accepts only known parser progress, state, quick-result, error and done events. It validates the final payload before database work: SHA-256 identifiers, ISO timestamps, nonnegative safe-integer combat totals, integral counts, finite rates, bounded arrays, unique encounter fingerprints and participant names. Fractional duration seconds are accepted; the existing integer seconds column is rounded while `durationMs` retains millisecond precision. Rates are stored from the parser without recomputing them from rounded seconds.

Parser SSE events are limited to 64 MiB each and 128 MiB per response; status JSON is limited to 8 MiB. These are response-memory ceilings, separate from input-file limits. A report exceeding them is rejected without persistence. Progress and status use explicit public fields and fixed error messages; arbitrary upstream fields, error text and debug details are not forwarded.

The status proxy separately admits at most eight active requests and 600 starts per minute per web process, retains its five-second upstream deadline and rejects redirects. A 429 response asks callers to retry after 60 seconds. Upload and status admission do not trust caller-controlled IP headers and are not fleet-wide quotas.

An upload, its encounters, participants and session analytics are committed in one PostgreSQL serializable transaction. A failed write rolls back the whole report. File/fingerprint uniqueness conflicts and serialization conflicts retry the complete transaction at most twice after the first attempt. These retries apply only to database work; the web service never automatically re-uploads bytes. Concurrent duplicates resolve to one completed stored report. Optional milestone failures return a saved report with a warning.

An existing `DONE` file hash returns its stored report and stored session route. Historical `PENDING`, `PARSING` or `FAILED` rows are not reported as successful duplicates and are not automatically rewritten or deleted. A maintainer must inspect an incomplete historical upload and choose the documented admin recovery action before retrying.

The additive upload provenance columns are nullable: `parserVersion`, `metricSchemaVersion`, `compatibilityProfile`, `referenceSha` and `parserParsedAt`. Missing provenance during a rolling parser deployment stays null. `parserParsedAt` records the parser timestamp; existing `parsedAt` records the web persistence timestamp. Migration rollback should retain these harmless nullable columns and roll back application code, without a destructive reverse migration.

## Timing Fields

- `networkUploadMs` - parser receive time through final byte
- `archiveValidationMs` - format/resource validation
- `quickClassificationMs` - difficulty-only scan
- `finalByteToQuickResultMs` - validation plus quick classification/handoff
- `fullProcessingMs` - complete parser aggregation

## Limits

| Control | Default | Environment variable |
| --- | ---: | --- |
| Compressed bytes | 100 MiB | `UPLOAD_MAX_COMPRESSED_BYTES` |
| Selected/total uncompressed bytes | 1 GiB | `UPLOAD_MAX_UNCOMPRESSED_BYTES` |
| Archive entries, including directories | 32 | `UPLOAD_MAX_ARCHIVE_MEMBERS` |
| ZIP directory metadata read | 1 MiB | `UPLOAD_MAX_ARCHIVE_METADATA_BYTES` |
| Physical decoded combat-log line | 65,536 characters | `UPLOAD_MAX_LINE_CHARS` |
| Compression ratio | 200:1 | `UPLOAD_MAX_COMPRESSION_RATIO` |
| Receive timeout | 300 seconds | `UPLOAD_RECEIVE_TIMEOUT_SECONDS` |
| Full processing timeout | 240 seconds | `UPLOAD_PROCESSING_TIMEOUT_SECONDS` |
| Concurrent uploads | 4 | `UPLOAD_CONCURRENCY` |
| Quick workers | 2 | `QUICK_CLASSIFICATION_WORKERS` |
| Full workers | 2 | `FULL_PROCESSING_WORKERS` |
| Retained progress states | 256, at least upload concurrency | `UPLOAD_STATE_LIMIT` |
| Abandoned-file retention | 1 hour | `UPLOAD_ABANDONED_SECONDS` |

The web request has a 270-second total parser deadline and a 300-second route budget. The parser phase limits are individual upper bounds, not a promise that their sum fits the caller deadline. Slow receive, validation or classification can therefore cause the web caller to cancel before the parser's later phase timeout. Disconnects cancel the upstream request; worker ownership and cleanup still finish in the parser. PostgreSQL persistence uses a 60-second transaction limit and 10-second acquisition limit per attempt. A successful parser response near the web deadline can leave insufficient time for persistence; no durable job queue or resumable guarantee is claimed.

Accepted suffixes are `.txt`, `.log`, and `.zip`, case-insensitively. ZIP magic must match, and a ZIP must contain exactly one regular `.txt` or `.log` combat log plus optional safe empty folders. Multiple logs, unrelated files and nonempty directory entries are rejected. ZIP members must use stored (uncompressed) or deflate compression; other methods are rejected before decompression because their Python readers do not provide the same bounded-output guarantees. Re-save an unsupported ZIP using standard deflate compression or upload the text log directly. Validation also rejects unsafe paths (including directories), symlinks/special files, encrypted members, duplicate member names, nested archives, excess entries/metadata, excess size, and excess per-member/total compression ratio. Archive paths are never extracted.

Admission validates the entire text as UTF-8 (optional BOM) or Windows-1252 before classification. Every nonblank record must be a recognized combat or supported metadata event with the required structure; binary controls, malformed/unknown records and excessive field complexity are rejected. Blank lines do not establish combat-log evidence. Valid syntax does not authenticate an event or prove a file malware-free. Every production input pass enforces the physical-line limit. Record/entity/cardinality and encounter-buffer limits reject pathological inputs with `LOG_COMPLEXITY_LIMIT`; limits are defined in `parser/archive_upload.py` and `parser/upload_limits.py`. They bound retained structures, not exact RSS: Python object overhead and aggregation are still subject to the process-isolation caveat above. Validation and quick classification each use the quick pool with a timeout of the lesser of 60 seconds and the full-processing timeout.

## Operational Signals

`GET /health` reports event-loop liveness. `GET /ready` returns 503 when the temporary directory is unavailable, not writable, or lacks space for one maximum-size upload. This checks local storage only; it does not assert web/database health or guarantee a later allocation. Saturated upload admission returns 429 independently of readiness.

Structured parser logs correlate completion/rejection/timeout/error events using the validated upload UUID. Completion includes byte count, encounter count and stage timings. Logs omit original filenames, raw log lines, player names, exception messages and filesystem paths. Operational counters remain process-local; fleet metrics and durable tracing require external collection.

## Legacy Routes

`POST /parse`, `/parse-debug`, and `/parse-stream` exist only for local compatibility tests and return 404 by default through an ASGI guard before FastAPI can read or spool multipart bodies. They require `ENABLE_LEGACY_PARSER_ROUTES=true` and enforce the same compressed byte ceiling. The public web upload has no fallback to them.

## Benchmark

From `parser/`:

```powershell
.venv\Scripts\python.exe benchmarks\benchmark_archive_upload.py --target-mib 30
```

The benchmark separates upload, validation, quick classification, full processing, and working-set measurements. Treat machine-specific results as comparative evidence, not production latency promises.
