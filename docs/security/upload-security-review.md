# Combat-log Upload Security Review

Author: Neil Mitchell
Last Modified By: Neil Mitchell
Review date: 2026-09-06
Baseline: `b3f1dba139d1c9de51d1e6970b4a157d020351f2`

## Scope and Method

This review covers browser selection and acknowledgement, the public Next.js upload/status routes, internal FastAPI receipt, ZIP/text admission, classification and full parsing, temporary-file lifecycle, validated database persistence, public report/API rendering, dependencies and upload-related production configuration. Findings were traced to code and exercised with synthetic local regression tests. No hostile traffic, malware execution or bulk load test was sent to production. It is not a certification or a professional penetration test of Railway or the operating system.

The trust chain is untrusted bytes and metadata → bounded web stream → private parser temporary file → validated text/events → schema-validated result → parameterized database transaction → escaped public report. Browser checks and the agreement are usability controls; server controls enforce acceptance.

## Confirmed Findings and Remediation

Severity describes the baseline defect, before this change. Confidence is based on code tracing and regression evidence, not the probability of an attacker appearing.

| Finding | Baseline exploit and impact | Remediation and evidence | Severity / confidence |
| --- | --- | --- | --- |
| Partial text validation admitted junk | `archive_upload._assert_usable_combat_log` stopped at one parseable timestamp/CSV record in an initial sample. A plausible prefix could admit later junk or binary content. Unknown event text alone could appear recognizable. | Validate every nonblank record, event structure and whole-file encoding; reject binary controls, unrecognized records and excessive complexity before classification. Synthetic prefix/tail and malformed-payload regressions cover the bypass. | High / 10 |
| ZIPs could carry unrelated payloads | `validate_upload` chose a usable text member while permitting unrelated ordinary files. An executable or script beside a valid log was accepted into temporary storage even though it was never executed or published. | Require exactly one regular `.txt`/`.log` file, safe empty folders only, no extra files or hidden directory payloads. Tests cover unrelated files, multiple logs, links, paths and compression controls. | Medium / 10 |
| Disabled multipart routes still consumed bodies | Legacy handler checks ran after FastAPI `File` dependency parsing. A request to a disabled route could spool multipart bytes before receiving 404. Current private parser networking reduced public exposure. | An early ASGI guard returns 404 before any receive/spooling. Regression asserts the receive callback is not called. Keep legacy mode off in production. | Medium / 10 |
| Craftable record shapes expanded worker memory | Quick/full paths retained arbitrary unfinished encounters, and attacker-controlled identities/spells could grow aggregation maps. Byte limits and thread timeouts alone did not bound these shapes. | Bound records, fields, identifiers/cardinality, session/encounter counts and retained encounter event/text buffers. Exercise cap failures in both quick/full paths and retain existing lifecycle cancellation coverage. Exact process memory and hard CPU isolation remain open below. | High / 9 |
| Web admission did not independently bound work | The web proxied bodies without its own active/start gate or actual-byte reconciliation. Repeated requests still consumed web connections; declared sizes could differ from received data. | Four active uploads and 12 starts/minute per process, actual streaming byte counter, exact declared/parser size agreement, abort check before persistence. Boundary/route tests prove early rejection, cancellation and slot release. Client IP headers cannot reset the gate. | Medium / 10 |
| Original filenames exposed publicly | Both public encounter list/detail projections selected `upload.filename`, exposing local file labels through enumerable public reports. There was no first-party public consumer of this field. | Remove only that field from the two public projections; regression keeps filename/uploader/hash/diagnostics private while preserving report metrics and realm/guild context. This is an intentional API tightening. | Medium / 10 |

Other changes require the current policy version server-side before processing, reject cross-site browser requests and encoded transport bodies, reject metadata controls/markup and parser redirects, and give browser users a recoverable error when a stream ends without completion. The agreement starts unchecked; it does not create identity or consent evidence in the database. The full user-facing rules are available at `/upload-policy`; every page links to the bug form and private security reporting.

## Controls Verified

- Upload bytes are never executed, imported as code or served for public download. Archive paths are not extracted. Server-generated file tokens determine temporary paths.
- Existing 100 MiB upload, 1 GiB expansion, 200:1 ratio, 32-entry, 1 MiB ZIP-directory and bounded-line controls remain in force. Both services count bytes; declared metadata is not trusted.
- Queued work can be cancelled; actual parser worker ownership holds the admission slot and file until work ends. Cleanup does not unlink a file still owned by a worker.
- The public status proxy separately limits eight active requests and 600 starts per minute per process, with a five-second upstream deadline and an 8 MiB response cap.
- Prisma persistence uses parameterized operations, schema validation and atomic transactions. No upload-to-shell/eval/unsafe-deserialization or injectable raw-SQL path was found. React escapes displayed names; raw upload text is not rendered as HTML.
- Both runtime containers run as non-root users. CI pins Actions and scanners and runs dependency review, CodeQL, Bandit, parser tests, complete-image vulnerability scans/SBOMs and browser acceptance.
- Live npm audit reported zero known vulnerabilities across 697 dependency entries. The hash-locked Python runtime audit reported zero known vulnerabilities across 20 packages. These are dated database results, not proof of absence of vulnerabilities.
- Read-only Railway checks at the baseline found one web and one parser replica on Hobby, successful deployments, no public parser domain, internal web-to-parser networking, legacy routes/docs off, and neither database credentials nor the admin key in the parser environment. No production variables or paid features were changed. No explicit service resource-limit overrides were evidenced; provider limits must not be confused with a per-job sandbox.

## Remaining Risks and Recommended Next Decisions

1. **No antivirus or hard per-job isolation.** Strict format checks reduce accepted content and attack surface; they cannot certify a file as virus-free or rule out vulnerabilities in Python/ZIP processing. Worker threads cancel cooperatively. Object overhead and intermediate aggregation can exceed input bytes, and a non-interruptible worker may retain capacity until it exits. A separately constrained worker process/container with a tested memory/CPU deadline is the next technical isolation step; an antivirus engine would add a different detection layer. No external scanning service receives raw logs.
2. **Anonymous abuse remains possible.** Valid-looking fabricated logs and uploader/guild labels have no cryptographic provenance. A bot can accept the policy and occupy bounded capacity. Current gates are process-local, reset on restart, and multiply with replicas. Authenticated/allowlisted uploaders, moderation and fleet-wide quotas require explicit product choices; a checkbox is not a bot defense.
3. **Long-term storage is not capped.** Parsed reports remain until a maintainer removes them. Rate limits slow growth but do not set a lifetime database/billing ceiling. Monitoring, retention and a storage quota remain operational decisions; no automatic deletion or plan upgrade was introduced.
4. **Compatibility is stricter.** ZIPs containing multiple logs or extra files now fail. Malformed, truncated, unknown-event or exceptionally complex logs can be rejected. Finish recording, preserve originals, and report a sanitized example of a rejected genuine log. Existing stored reports are not reparsed or rewritten. The existing direct-streaming restart/reupload boundary remains unchanged.
5. **Disclaimers are explanatory.** The upload acknowledgement explains permitted content, permission to share and public visibility. The bug notice explains possible errors and reporting. Neither is represented as a legally reviewed waiver, an authenticated consent record, or a security guarantee.

## Validation and Release Gate

The local Windows parser validation passed 450 tests, including existing analytical fixtures and new adversarial admission/complexity cases; Ruff and Bandit also passed. A local synthetic 30 MiB ZIP benchmark completed with 31,764,673 compressed bytes, 99,889,020 uncompressed bytes and 110 matching quick/full attempts. Whole-file validation took 3.23 seconds, quick classification 1.84 seconds and full parsing 4.85 seconds; sampled peak RSS was 63.93 MiB. These are machine-specific synthetic measurements, not production or worst-case memory guarantees. Whole-file validation means the earlier under-two-second quick-preview goal is not met by this sample: final-byte-to-quick is approximately 5.08 seconds. Correct admission takes precedence over preview speed.

Run `npm run check:pr`, the full hash-locked parser pytest suite, isolated PostgreSQL/contract tests and the headless upload journey. The latter verifies unchecked acceptance, revocation, reset for a new upload, successful and duplicate reports, public bug links and responsive controls. Attack cases run locally with harmless synthetic bytes; do not load-test production. Final CI must also pass the production-OS parser tests, image scans and browser suites.

After merge, verify both Railway service revisions, production smoke, the visible policy/footer and safe rejection of a missing-policy request before any upload body is accepted. A benign end-to-end upload requires an authorized synthetic fixture; do not publish a private raid log to test a release. This document does not, by itself, establish that a merge or deployment has completed.

## Reference and Limitation

The review uses the [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) and [Denial of Service Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html) as references for layered validation and resource limits.

This AI-assisted review is not a substitute for an independent professional security audit. It can miss subtle vulnerabilities and cannot guarantee that every malicious upload or attack will be detected.
