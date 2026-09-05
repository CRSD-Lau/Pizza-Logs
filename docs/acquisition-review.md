# Quality review and release conditions

Author: Neil Mitchell

Last modified by: Neil Mitchell

Observed: 2026-09-04; asset scope clarified: 2026-09-05

## Decision

**Continue improving the site against the documented quality findings.** Neil
Mitchell confirmed on 2026-09-05 that the acquisition framing was a quality benchmark;
Pizza Logs is his own site and is not being sold or transferred. Buyer-facing asset
assignment and transfer clearance are not current release conditions. The application
has a useful, independently implemented raid-analysis core and reproducible database,
parser, upload and browser gates. It is not yet a demonstrated replacement for all UwU
analytical surfaces. A green regression build is not evidence of full parity,
continuous availability, a successful restore, or security certification.

The starting Pizza revision was `8a90aee2651663613b8aaf2dbd148ea493eae2a3`.
The initial delivery PR records its final revision and hosted checks. That initial
review used ordinary public HTTP/smoke requests; authenticated follow-up reads and
isolated restoration are recorded below. No production uploads, database writes,
environment changes or agent-triggered deployment occurred during either review.

### Follow-up after PR 72

PR 72 was merged as `b1e5520536e2c8dd65a8ea0924533f952bc34edd` on 2026-09-04.
Railway reported successful web and parser deployments from that revision. The
[post-deployment smoke run](https://github.com/CRSD-Lau/Pizza-Logs/actions/runs/33922902058)
passed all 12 public checks, dependency readiness returned 200, and GitHub reported
zero open Dependabot alerts. These observations replace the earlier delivery's
pending-deployment status; they do not close unrelated quality findings.

PR 77 was merged as `b5636482eea8527d2cafc0824c7f6dca4fa8d8be` on 2026-09-04.
It adds complete hover-model framing, a reviewed Alpine parser runtime, full-image
security gates, six additional paired reference cases, database recovery evidence
tooling and an exact asset provenance register. Railway reported successful web
and parser deployments from that revision. The
[post-deployment smoke run](https://github.com/CRSD-Lau/Pizza-Logs/actions/runs/33928110204)
passed all 12 public checks, and dependency readiness returned 200. These observations
verify that rollout; the CI image scans do not claim a separate scan of Railway's
registry images.

A subsequent permitted private ICC comparison exposed omitted healing to non-player
recipients and missing Fel Synergy pet evidence. Parser `1.1.1` corrects both with
original synthetic regressions; the [parity evidence](uwu-analytics-parity.md)
documents remaining differences and corpus limits. These parser corrections require
their own PR and deployment verification. Private combat data remains outside Git.

Authenticated production reads confirmed all 12 migration names successfully
applied, with one older rolled-back ledger record preserved. All three historical
uploads were DONE; none needed incomplete-upload reconciliation. Their provenance
is null because they predate the new parser fields. No historical report was
rewritten, no synthetic report was published to production, and no production
environment variable was changed.

A snapshot-consistent logical export was encrypted with AES-256-GCM and a
Windows-user-protected key, then restored to a separate local PostgreSQL 18 database.
All 13 table contents, enums, columns, indexes, constraints, migration records and
report totals matched; Prisma reported no schema drift. Data restoration took 0.61
seconds and content/schema verification 0.49 seconds after the local destination
was prepared. These are component timings, not an incident RTO or a provider
snapshot/PITR restoration. Private data and recovery files remain outside Git.

The final local web/parser images passed 66 responsive synthetic browser renders,
upload/duplicate/retry and admin acceptance, and complete zero-finding container
scans. Additional upload/duplicate/retry tests on the isolated restored copy verified
new parser provenance and preserved every original row across all 13 tables.
The code gate passed 87 TypeScript tests and 388 parser tests on the runtime OS.

## Scope and evidence

The [surface inventory](architecture/surface-inventory.md) covers pages, APIs, actions,
parser endpoints, egress and scheduled work. The [architecture](architecture/overview.md),
[threat model](security/threat-model.md), [parser contract](parser-contract.md) and
[reference matrix](uwu-analytics-parity.md) describe the boundaries and exceptions.

The seed contains 53 boss records and four realm labels. Labels are not proof of
support: the parser targets Warmane/WotLK 3.3.5 logs, not modern Retail combat logs.
ICC, Ruby Sanctum and other configured boss definitions have uneven fixture coverage;
the three canonical fixture directories and focused tests do not establish every
raid, mode, class, pet and special-mechanic combination. Existing historical acceptance
JSON is preserved but cannot replace its missing source archive.

The code review used independent agent opinions and cross-review. Security review
was organized around OWASP ASVS 5.0, Top 10 (2025), API Top 10 (2023), and CWE Top 25
(2025), not presented as a certified checklist assessment. It covered admission and
archive limits, parser output validation, public/private routes, admin actions and
cookies, upstream egress, SQL boundaries, migrations, CI trust, locks and containers.
No adversarial traffic or load was sent to production or UwU.

### Starting gates

| Command / observation | Baseline | Seconds | Interpretation |
|---|---|---:|---|
| `npm ci --legacy-peer-deps` | Pass | 18.21 | Three npm audit findings existed. |
| `npm run check:pr` | Pass | 51.68 | Existing gates did not detect the fresh migration failure. |
| Hash-locked Python install | Pass | 3.44 | Python 3.14.5 isolated environment. |
| `pytest tests/ -v` | 301 passed | 4.39 | Original canonical coverage preserved. |
| Prisma generation / validation | Pass / pass | 8.26 / 1.78 | Schema syntax alone did not prove migration history. |
| `prisma migrate deploy` on an empty database | Fail | 2.91 | P3018: missing core table before first historical migration. |
| `docker compose config --quiet` | Pass | 0.53 | Static configuration only. |
| Web / parser image builds | Pass / pass | 82.93 / 13.30 | Baseline web runtime required bootstrap workaround in isolated test DB. |
| Ruff / Bandit / pip-audit | Pass | 0.22 / 1.47 / 3.61 | Bandit noted an existing stale `nosec` annotation. |
| `npm audit` | Fail | Recorded in PR evidence | Vulnerable fast-uri/mysql2 dependency paths. |
| Production smoke | 12 checks passed | 3.34 | Point-in-time public read checks only. |
| Seeded browser baseline | 54 renders | Recorded in artifacts | Nine routes, six widths; no horizontal overflow. |

### Findings and disposition

Likelihood describes the triggering situation, not a fabricated incident frequency.
Public descriptions deliberately omit payloads and detailed exploitation procedures.

| ID / severity | Evidence / failure and business impact | Likelihood | Remediation and status | Residual / validation |
|---|---|---|---|---|
| A01 P1 High | `start.sh`, migration history: an empty database could not start; blind legacy adoption could hide missing schema work. | Certain on clean baseline DB | **Fixed:** initial core migration, verified adoption, preserve failed records, fail startup. | Fresh DB/custom-schema tests and restored production schema/ledger verification passed. Native provider recovery remains A13. |
| A02 P1 High | Old upload route wrote related rows separately; interrupted/conflicting writes could expose incomplete reports. | Plausible during failure or concurrent uploads | **Fixed:** serializable complete-report transaction, bounded conflict retries, completed-duplicate requirement. | Real PostgreSQL rollback/concurrent-duplicate tests and restored-copy acceptance passed. All three historical uploads were DONE; no incomplete rows were found. |
| A03 P1 High | Worker cancellation could release admission/files before computation stopped; archive metadata/decompression paths had incomplete resource bounds. | Plausible with cancellation or invalid input | **Fixed:** explicit worker/file ownership, metadata/line/member limits, stored/deflate-only ZIP. | Local failure/cancellation/ZIP tests; hard CPU termination and fleet-wide throttling remain infrastructure work. |
| A04 P1 High | Dependency scanners found vulnerable transitive packages and unnecessary runtime installer tools. | Depends on affected package path | **Fixed in application dependency scope:** fast-uri/mysql2 updates and removal of unused runtime npm/pip tooling. | npm/pip audits and web scan clean at observation. Parser OS findings remain A14. |
| A05 P2 Medium | Timestamp handling merged separate calendar dates at equal clock times; environmental incoming damage was omitted. | Valid affected logs | **Fixed:** calendar validation/year rollover and correct incoming fields; canonical outgoing totals preserved. | Full parser suite and minimal paired/regression fixtures. Historical rows are not rewritten. |
| A06 P2 Medium | Milestone all-time early returns suppressed weekly awards; duplicate attempts affected ranks; pre-cutoff weekly boundary and historical uploads were mishandled. | Ordinary uploads | **Fixed:** independent periods, distinct-player competition rank, actual encounter date, atomic award writes. | Real PostgreSQL milestone tests. Ranks remain recorded achievements, now labeled accordingly. |
| A07 P2 Medium | Public list parameters allowed invalid/unbounded values; player statistics used a recent subset; UNKNOWN counted as wipe; names were decoded twice. | Ordinary or malformed queries | **Fixed:** bounded query schema, full aggregates, explicit outcome counts, single decoding. | Unit/source/API acceptance tests. Pagination cap is 10,000 skipped rows, not arbitrary deep access. |
| A08 P2 Medium | Boss/weekly APIs hydrated large participant/analytics graphs to compute small results. | Growth in report volume | **Fixed:** parameterized database aggregates with stable tie ordering. | Equivalent-result tests over 1,000 encounters/3,000 participants; measured reductions below. |
| A09 P2 Medium | Upstream body consumption and non-success responses could outlive intended timeout/resource limits. | Slow/malformed Warmane responses | **Fixed:** decoded body bounds, redirect rejection, complete-body deadlines and cancellation. | Mock stream/fallback tests; last healthy gear survives outages. |
| A10 P2 Medium | Runtime database adapter ignored custom schema configuration, including raw aggregate queries. | Custom schema deployment | **Fixed:** adapter schema and safely encoded per-connection search path. | Real pooled queries and writes verified isolated; empty, null, quoted or >63-byte schema names fail early. |
| A11 P2 Medium | Missing field associations, a stopped file-picker click and low-contrast metadata/admin controls impaired use. | Affected widths/surfaces | **Fixed:** explicit picker action, native labels, progress/error semantics, readable tokens and larger controls. | Headless file chooser/upload/retry, axe and responsive checks; automated testing is not screen-reader certification. |
| A12 P1 High, open | [Parity matrix](uwu-analytics-parity.md): broad historical claims exceeded independently observed evidence. | Certain for a full replacement claim | **Coverage expanded; full parity incomplete.** Fourteen exact synthetic cases, twelve explicit mismatches, seven unproven categories; four private ICC samples exposed two parser corrections. | Private ICC data is now available. Broader modes/raids, unresolved attribution/detail differences and the missing historical source archive still need evidence; synthetic and private results remain distinct. |
| A13 P1 High, open | Provider inspection found no scheduled backups; newest listed snapshot was 2026-08-23. | Recovery exposure is confirmed; native restoration remains untested | **Logical restore verified; provider recovery remains open.** Neil chose to keep Railway backup settings unchanged. | Respect that decision. Enterprise RPO/RTO remains unproven until an independently approved provider backup and isolated restore demonstration exists. |
| A14 Critical/High scanner findings, remediated and deployed | Previous Debian parser image reproduced 3 Critical and 51 High package/advisory instances. | Historical runtime package exposure; future images require scanning | **Reviewed replacement scans clean; PR 77 rollout verified.** Digest-pinned supported Alpine runtime, actual-OS tests, unchanged hash locks and no severity suppression. | [Runtime evidence and tradeoffs](operations/parser-runtime.md): 388 tests, real HTTP cancellation/upload checks, zero detected OS/Python findings. Railway source revision/readiness and production smoke passed; future Critical/High findings block CI. |
| A15 P2 Medium, open pending operational acceptance | Private identity/MFA implementation replaces shared-secret admin access; progress/admission remain process-local, with single-region dependencies and a single CODEOWNER. | Operational growth or outage | **[Admin login implemented](operations/admin-access.md); deployment and real enrollment remain required.** | Record deployed MFA acceptance and the remaining upload-reliability decision. Interrupted uploads still require reupload; no added infrastructure cost is authorized. |
| A16 P2 Medium, scope resolved | The earlier asset-clearance condition assumed a sale or transfer that is not planned. | Acquisition/transfer is out of scope | **[Asset scope corrected](security/asset-provenance.md):** Neil identifies the intro as Veo-generated and social preview as ChatGPT-generated. Font/jQuery notices are retained; no UwU code/assets copied. | Buyer clearance is not a current release gate. Ordinary third-party terms still apply; unverified media-use details remain recorded without claiming blanket rights certification. |

Four High implementation finding groups and seven Medium groups were corrected.
The open rows remain quality findings with their stated evidence and owner decisions.
The follow-up work is assigned to the maintainer in GitHub:
[A12 representative parity](https://github.com/CRSD-Lau/Pizza-Logs/issues/73),
[A13 provider recovery](https://github.com/CRSD-Lau/Pizza-Logs/issues/74),
[A15 identity and durable uploads](https://github.com/CRSD-Lau/Pizza-Logs/issues/75).
[A16 asset rights](https://github.com/CRSD-Lau/Pizza-Logs/issues/76) records the corrected
scope; it is not a buyer-clearance prerequisite for the owner's site. Each issue
records its evidence or decision.
No exposed secret was detected in the scanned history/delivery diff; no rotation was
triggered by a discovered value. This does not attest to provider-side secret handling.

### Supply chain and repository hygiene

Both containers run non-root. Build contexts exclude personal notes, caches and Python
bytecode. Locks/hash enforcement and commit-pinned Actions are retained; no broad major
dependency upgrade was performed. `main` has an active ruleset requiring PRs and strict
`test-build`, `dependency-review`, and JavaScript/TypeScript and Python CodeQL checks.
CODEOWNERS names the single maintainer; a second operational owner remains advisable.

Gitleaks scanned all 361 starting commits without findings. Its delivery scan flagged
four `api_*.py` entries in the reference inventory; all four were independently checked
against the pinned public Git tree and are Git blob hashes, not credentials. No blanket
ignore was added. Git pack size was about
728.56 MiB; historical intro/media blobs reached about 42.6 MiB. History was not rewritten.
Current and historical media are not safe deletion candidates merely because they are
large. A separately approved retention/asset and history-migration plan is required.
The unrelated local notes directory was preserved and excluded from the delivery.

SBOMs/scanner output, benchmark samples and screenshots are evidence artifacts, not
application source. Follow-up CI retains synthetic acceptance and complete container
scan/SBOM artifacts for 90 days (PR 72 used 14 days). The PR links the exact run; the
maintainer should archive relevant evidence under controlled retention before expiry.

## Performance and capacity

Matched parser images ran alternating three samples per size with 2 CPUs and 512 MiB,
using the same deterministic ZIP benchmark. Compressed 1/10/30 MiB inputs expanded to
3.63/31.78/93.53 MB. These are local warm-host samples, not a fleet capacity forecast.
Report medians and observed maxima; three samples do not support p95/p99 claims.
Final median total archive-processing times were 219.87 -> 230.01 ms (1 MiB),
1,825.22 -> 1,876.45 ms (10 MiB), and 5,330.13 -> 5,579.68 ms (30 MiB): about
2.8-4.7% overhead for the added validation/calendar handling. This is not a parser speedup.
Maximum observed RSS was 67.11 -> 70.55 MiB for the largest case, within the 512 MiB
container allocation. Final-byte-to-quick-result median at 30 MiB was 1,479.06 ->
1,572.97 ms. A profiled eager accumulator allocation was removed with identical output
hashes; throughput/CPU saturation and long-duration tail latency remain unmeasured.

For database queries, 15 warm samples over 1,000 encounters and 3,000 participants showed:

| Query | p50 before -> after | p95 before -> after | Serialized result bytes before -> after |
|---|---|---|---|
| Boss summary | 12.75 -> 3.95 ms | 16.56 -> 4.54 ms | 124,100 -> 372 |
| Weekly summary | 34.79 -> 1.69 ms | 39.59 -> 2.76 ms | 1,102,318 -> 865 |

The comparison verifies numerical/filter equivalence, including unknown outcomes and
week endpoints. It does not claim that an empty-week HTTP benchmark measures production
capacity. High-cardinality analytics JSON and very long single encounters still need
representative private-corpus load tests. Full browser p99, field Core Web Vitals,
long-duration saturation, and multi-replica capacity were not measured.

## Reliability, rollout and owner actions

Use the [service objectives and recovery procedure](operations/service-objectives.md)
and [Railway rollout procedure](operations/railway.md). The proposed public-read SLO is
99.5% over 30 days; persistence is 99.9%, with zero partial accepted reports. These are
targets, not measured uptime. Proposed RPO <=24 hours/RTO <=4 hours require a backup and
restore demonstration. Nine nines would allow about 31.5 ms of annual downtime and is
not credible for this unmeasured single-region dependency chain.

Before deployment the owner must resolve/accept the applicable A12-A15 findings,
preserve a verified database backup, inspect existing schema/ledger drift, and
capture current image SHAs.
Deploy the parser first, then the web additive migrations and new web image. Verify
readiness, synthetic acceptance in staging and ordinary production smoke. Stop if
migration/startup fails; do not clear the ledger or mark failures applied. Roll back
application behavior through a protected revert PR, leaving additive columns/data intact.
Restore only through the reviewed recovery procedure if actual data corruption is shown.

## Visual scope

Dark surfaces, gold accents, typography, logo, navigation and report composition remain.
Changes address measured contrast and label defects. Class colors remain on accents/fills;
meaningful text uses readable semantic foreground tokens. Weekly and all-time banners
now describe their actual period. Browser artifacts compare seeded routes at 360, 390,
768, 1024, 1440 and 1920 pixels. External browser assets are blocked; an isolated local
network additionally exercises bounded server-side Warmane fallback without live egress.

## Reference standards

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP API Security](https://owasp.org/API-Security/)
- [CWE Top 25, 2025](https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html)
- [Debian Perl package status](https://security-tracker.debian.org/tracker/source-package/perl)

The three Critical parser-base records were CVE-2026-13221, CVE-2026-42496 and
CVE-2026-8376 in `perl-base 5.40.1-6`; the reviewed web/parser application path does not
invoke Perl, but this limited observation is not a blanket exploitability clearance.
