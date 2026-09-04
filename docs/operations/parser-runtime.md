# Parser runtime and base-image maintenance

Author: Neil Mitchell

Last modified by: Neil Mitchell

## Runtime contract

The parser uses the Docker Official Python 3.14 Alpine 3.24 image, pinned by
manifest digest in [`parser/Dockerfile`](../../parser/Dockerfile). The final
`runtime` target runs as UID/GID 10001 and retains the existing hash-locked
application dependencies. It does not contain pip, setuptools, wheel or pytest.
No parser formulas, archive limits, cancellation rules or dependency versions
were changed for the base-image migration.

Alpine uses musl instead of Debian's glibc. The Python image maintainers document
this [compatibility distinction](https://hub.docker.com/_/python). Production
build and acceptance evidence currently cover Linux amd64. Do not infer support
for another architecture merely because the pinned image index contains it.

The `test` target shares the same base, runtime dependency installation and parser
source, then adds the hash-locked development dependencies. It is separate from
the default/final runtime target:

```bash
docker build --pull -f parser/Dockerfile -t pizza-logs-parser:review .
docker build --target test -f parser/Dockerfile -t pizza-logs-parser:test .
docker run --rm --network none --cpus 2 --memory 512m pizza-logs-parser:test
```

Do not deploy the test target. The service continues to listen on `PORT` (8000
by default); platform ingress and network exposure remain unchanged.

## Security observation and limits

A fresh Trivy 0.74.0 scan on 2026-09-04 reproduced the previous Debian parser
image's 3 Critical, 51 High, 55 Medium, 57 Low and 7 Unknown package/advisory
instances. The reviewed Alpine runtime had **zero detected OS and Python
findings**, without severity suppression, an ignore file or `--ignore-unfixed`.
The CycloneDX inventory decreased from 108 to 51 components. These are scanner
observations at a specific database revision, not a certification of future
vulnerability absence or application security.

Trivy's built-in end-of-life table warned that Alpine 3.24 was unknown. Its scan
still selected the Alpine 3.24 advisory repository and enumerated 30 OS packages.
The [vendor's release table](https://www.alpinelinux.org/releases/) independently
lists 3.24 as supported through 2028-06-01, and the
[3.24 main security database](https://secdb.alpinelinux.org/v3.24/main.json)
contains current package advisories. Do not suppress or reinterpret an unsupported
OS warning without checking the vendor release and advisory coverage.

The pull request's evidence records exact application image IDs, base digest,
scanner version/database timestamp, full before/after JSON reports and SBOMs.
SBOM Author/Creator and modifier metadata are Neil Mitchell.

## Compatibility and performance evidence

The original 380-test parser suite passed inside the Alpine image. The integrated
test target subsequently passed 388 tests, including expanded parity coverage.
Native imports for pydantic-core, httptools, watchfiles, websockets and PyYAML
passed. The final runtime was also checked for non-root execution and absence
of the installer/test packages.

Real HTTP acceptance covered health/readiness, stored and deflated ZIP uploads,
quick-result ordering, complete output/provenance, unsupported-codec rejection,
disconnects during reception and processing, temporary-file cleanup, and a
successful subsequent upload. This supplements the focused worker-ownership and
archive tests; it does not establish hard process termination or durable jobs.

The same deterministic benchmark ran in network-isolated containers with 2 CPUs
and 512 MiB. Samples alternated between the previous Debian runtime and Alpine.
Three pairs were measured at 1 and 30 MiB. The variable 10 MiB result received
three additional pairs in reverse order; all six pairs remain in the evidence.

| Target compressed size | Samples per runtime | Debian total median | Alpine total median | Change |
|---|---:|---:|---:|---:|
| 1 MiB | 3 | 226.16 ms | 242.72 ms | +7.32% |
| 10 MiB | 6 | 2,026.76 ms | 2,356.28 ms | +16.26% |
| 30 MiB | 3 | 5,716.36 ms | 6,175.55 ms | +8.03% |

The 30 MiB case expanded to 93.53 MB. Its maximum observed peak RSS decreased
from 70.58 to 66.86 MiB, and median final-byte-to-quick-result time was 1,580.34
to 1,471.85 ms. The change removes the observed vulnerable Debian packages at
a measured processing-time cost. It is not a parser speed improvement. Small
local samples do not establish sustained capacity, production latency or p95/p99.

## Refresh and release gates

The existing weekly `/parser` Docker Dependabot schedule proposes base updates.
Review both the tag and digest; digest pinning must not become an excuse to retain
an obsolete base. Every update must:

1. Build the final runtime and the test target, then run the complete parser suite
   inside the target OS as appuser.
2. Scan the actual final image with a current advisory database. Retain every
   severity in the JSON report and fail the release gate on Critical or High
   findings, including unfixed findings. Do not disable the gate to ship an update.
3. Retain the SBOM, image identity and scanner metadata. Investigate unsupported
   OS/advisory-source warnings against primary vendor evidence.
4. Verify native imports and real health/upload/cancellation behavior. Repeat
   matched performance measurements for Python, libc or native-library changes.
5. Follow the [Railway rollout procedure](railway.md), including parser-first
   deployment and production smoke. A passing local image does not prove that
   production is running the reviewed digest.

Keep the previous application image available for operational rollback. A rollback
to the older Debian image reintroduces its recorded security findings; treat that
as a time-bounded incident decision and follow with a corrected reviewed image.
