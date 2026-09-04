# Acquisition review and release conditions

Author: Neil Mitchell

Last modified by: Neil Mitchell

Observed: 2026-09-04

## Decision

**Buy with conditions.** The application has a useful, independently implemented
raid-analysis core and now has reproducible database, parser, upload and browser gates.
It is not yet a demonstrated replacement for all UwU analytical surfaces. Acquisition
and an enterprise production commitment require the parity, base-image, recovery and
ownership conditions below. A green regression build is not evidence of full parity,
continuous availability, a successful restore, or security certification.

The starting Pizza revision was `8a90aee2651663613b8aaf2dbd148ea493eae2a3`.
The delivery PR records its final revision and hosted checks. Production was inspected
only through ordinary public HTTP/smoke requests. No production uploads, database writes,
environment changes or deployment occurred during this review.

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
| A01 P1 High | `start.sh`, migration history: an empty database could not start; blind legacy adoption could hide missing schema work. | Certain on clean baseline DB | **Fixed:** initial core migration, verified adoption, preserve failed records, fail startup. | Fresh DB and custom-schema adoption tests; production schema/backup inspection still required. |
| A02 P1 High | Old upload route wrote related rows separately; interrupted/conflicting writes could expose incomplete reports. | Plausible during failure or concurrent uploads | **Fixed:** serializable complete-report transaction, bounded conflict retries, completed-duplicate requirement. | Real PostgreSQL rollback/concurrent-duplicate tests. Historical incomplete rows require owner reconciliation. |
| A03 P1 High | Worker cancellation could release admission/files before computation stopped; archive metadata/decompression paths had incomplete resource bounds. | Plausible with cancellation or invalid input | **Fixed:** explicit worker/file ownership, metadata/line/member limits, stored/deflate-only ZIP. | Local failure/cancellation/ZIP tests; hard CPU termination and fleet-wide throttling remain infrastructure work. |
| A04 P1 High | Dependency scanners found vulnerable transitive packages and unnecessary runtime installer tools. | Depends on affected package path | **Fixed in application dependency scope:** fast-uri/mysql2 updates and removal of unused runtime npm/pip tooling. | npm/pip audits and web scan clean at observation. Parser OS findings remain A14. |
| A05 P2 Medium | Timestamp handling merged separate calendar dates at equal clock times; environmental incoming damage was omitted. | Valid affected logs | **Fixed:** calendar validation/year rollover and correct incoming fields; canonical outgoing totals preserved. | Full parser suite and minimal paired/regression fixtures. Historical rows are not rewritten. |
| A06 P2 Medium | Milestone all-time early returns suppressed weekly awards; duplicate attempts affected ranks; pre-cutoff weekly boundary and historical uploads were mishandled. | Ordinary uploads | **Fixed:** independent periods, distinct-player competition rank, actual encounter date, atomic award writes. | Real PostgreSQL milestone tests. Ranks remain recorded achievements, now labeled accordingly. |
| A07 P2 Medium | Public list parameters allowed invalid/unbounded values; player statistics used a recent subset; UNKNOWN counted as wipe; names were decoded twice. | Ordinary or malformed queries | **Fixed:** bounded query schema, full aggregates, explicit outcome counts, single decoding. | Unit/source/API acceptance tests. Pagination cap is 10,000 skipped rows, not arbitrary deep access. |
| A08 P2 Medium | Boss/weekly APIs hydrated large participant/analytics graphs to compute small results. | Growth in report volume | **Fixed:** parameterized database aggregates with stable tie ordering. | Equivalent-result tests over 1,000 encounters/3,000 participants; measured reductions below. |
| A09 P2 Medium | Upstream body consumption and non-success responses could outlive intended timeout/resource limits. | Slow/malformed Warmane responses | **Fixed:** decoded body bounds, redirect rejection, complete-body deadlines and cancellation. | Mock stream/fallback tests; last healthy gear survives outages. |
| A10 P2 Medium | Runtime database adapter ignored custom schema configuration, including raw aggregate queries. | Custom schema deployment | **Fixed:** adapter schema and safely encoded per-connection search path. | Real pooled queries and writes verified isolated; empty, null, quoted or >63-byte schema names fail early. |
| A11 P2 Medium | Missing field associations, a stopped file-picker click and low-contrast metadata/admin controls impaired use. | Affected widths/surfaces | **Fixed:** explicit picker action, native labels, progress/error semantics, readable tokens and larger controls. | Headless file chooser/upload/retry, axe and responsive checks; automated testing is not screen-reader certification. |
| A12 P1 High, open | [Parity matrix](uwu-analytics-parity.md): broad historical claims exceeded independently observed evidence. | Certain for a full replacement claim | **Claims corrected; full parity incomplete.** Nine exact cases, eleven explicit mismatches, seven unproven categories. | Owner must provide the safe historical archive and permitted live report/version evidence, then extend clean-room projections and paired corpus. |
| A13 P1 High, open | No verified provider backup/PITR configuration, restore drill or availability history was available. | Unknown | **Repository runbook complete; infrastructure blocked.** | Infrastructure owner must verify backups and timed isolated restore before accepting enterprise RPO/RTO. |
| A14 Critical/High scanner findings, open | Final Debian parser base: 3 Critical and 51 High package/advisory instances. | Runtime reachability varies; not fully established | **No blanket suppression.** Removed fixable language tooling; current stable Debian base still reports affected/deferred packages. | Owner must approve package reachability evidence or a patched supported base, then rebuild, rescan and rerun parser/container gates before production release. |
| A15 P2 Medium, open | Shared-secret admin model, process-local progress/admission, single-region dependencies and single CODEOWNER. | Operational growth or outage | **Bounded locally; architecture decision deferred.** | Add identity/MFA, distributed admission and durable job storage only with owner/provider design, privacy and cost approval. |
| A16 P2 Medium, open | Warcraft-related media and external source rights are not established by npm license metadata. | Commercial acquisition/distribution | **Inventory updated; rights not certified.** No UwU code/assets copied. | Commercial owner must obtain rights/attribution review; public source visibility does not grant reuse permission. |

Four High implementation finding groups and seven Medium groups were corrected.
The open rows are release/acquisition conditions, not silently accepted exceptions.
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
application source. CI retains synthetic acceptance artifacts for 14 days. The PR links
the exact run; an acquirer should archive the approved evidence under controlled retention.

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

Before deployment the owner must resolve/accept A12-A16 explicitly, preserve a verified
database backup, inspect existing schema/ledger drift, and capture current image SHAs.
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
