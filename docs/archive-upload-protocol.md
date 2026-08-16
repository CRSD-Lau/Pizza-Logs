# Streamed Upload Protocol

The public upload path sends one bounded raw-byte request and receives Server-Sent Events. It does not buffer the whole archive in the browser or Next.js process.

## Browser to Web

```http
POST /api/upload?filename=raid.zip&fileSize=31621979&uploaderName=Name
Content-Type: application/octet-stream
X-Upload-ID: <lowercase UUIDv4 from crypto.randomUUID()>
X-Filename: raid.zip

<raw file bytes>
```

The web route sanitizes the base filename, validates declared/content length against the 100 MiB ceiling, validates metadata, and requires a UUIDv4 plus octet-stream body. It does not expose parser exception text.

## Web to Parser

```http
POST /uploads/<upload-id>/stream
Content-Type: application/octet-stream
X-Filename: raid.zip

<forwarded request stream>
```

The parser writes only `<upload-id>.part` inside its verified upload directory while calculating SHA-256 and counting received bytes. It flushes/fsyncs and atomically renames to `<upload-id>.upload` after the final byte. A reused upload ID returns 409.

The temporary file is removed after processing. Abandoned `.part`/`.upload` files are cleaned after the configured retention window when upload cleanup runs.

## States

```text
uploading -> validating -> classifying -> quick-result-ready
          -> full-processing -> complete | error
```

The browser knows the ID before transfer. Parser state is available through `GET /uploads/<upload-id>` and the web proxy `GET /api/upload/status/<upload-id>` while the ephemeral state remains in memory.

`quick-result` contains attempt segmentation/difficulty only. It is not a stored report and does not mean full parsing is complete. The final `done` event contains validated encounters, warnings, SHA-256, parser-observed `receivedBytes`, session analytics, and timing fields.

## Timing Fields

- `networkUploadMs` — parser receive time through final byte
- `archiveValidationMs` — format/resource validation
- `quickClassificationMs` — difficulty-only scan
- `finalByteToQuickResultMs` — validation plus quick classification/handoff
- `fullProcessingMs` — complete parser aggregation

## Limits

| Control | Default | Environment variable |
| --- | ---: | --- |
| Compressed bytes | 100 MiB | `UPLOAD_MAX_COMPRESSED_BYTES` |
| Selected/total uncompressed bytes | 1 GiB | `UPLOAD_MAX_UNCOMPRESSED_BYTES` |
| Archive files | 32 | `UPLOAD_MAX_ARCHIVE_MEMBERS` |
| Compression ratio | 200:1 | `UPLOAD_MAX_COMPRESSION_RATIO` |
| Receive timeout | 300 seconds | `UPLOAD_RECEIVE_TIMEOUT_SECONDS` |
| Full processing timeout | 240 seconds | `UPLOAD_PROCESSING_TIMEOUT_SECONDS` |
| Concurrent uploads | 4 | `UPLOAD_CONCURRENCY` |
| Quick workers | 2 | `QUICK_CLASSIFICATION_WORKERS` |
| Full workers | 2 | `FULL_PROCESSING_WORKERS` |
| Abandoned-file retention | 1 hour | `UPLOAD_ABANDONED_SECONDS` |

Accepted suffixes are `.txt`, `.log`, and `.zip`, case-insensitively. ZIP magic must match, and a ZIP must contain a recognizable `.txt` combat log. Validation rejects unsafe paths, symlinks, encrypted members, nested archives, excess members, excess size, and excess per-member/total compression ratio. Archive paths are never extracted.

## Legacy Routes

`POST /parse`, `/parse-debug`, and `/parse-stream` exist only for local compatibility tests and return 404 by default. They require `ENABLE_LEGACY_PARSER_ROUTES=true` and enforce the same compressed byte ceiling. The public web upload has no fallback to them.

## Benchmark

From `parser/`:

```powershell
.venv\Scripts\python.exe benchmarks\benchmark_archive_upload.py --target-mib 30
```

The benchmark separates upload, validation, quick classification, full processing, and working-set measurements. Treat machine-specific results as comparative evidence, not production latency promises.
