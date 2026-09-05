# Service objectives and recovery

Author: Neil Mitchell

Last modified by: Neil Mitchell

These are proposed operating targets, not measured availability or verified backup guarantees.
The single-region web/parser/PostgreSQL topology cannot credibly promise nine nines: that
would allow only about 31.5 milliseconds of downtime annually across every dependency.

## Indicators and provisional targets

| Indicator | Eligible events | Initial 30-day target | Error budget |
|---|---|---|---|
| Public report reads | Valid read requests; exclude client cancellations and invalid requests | 99.5% successful, p95 below 2 seconds | 0.5% failed eligible reads; 216 minutes is the time-based analogue |
| Upload acceptance | Valid uploads within published size and capacity limits | 99% accepted | 1% unexpected rejection; capacity 429s tracked separately, not hidden |
| Parse completion | Accepted, valid supported logs below resource budgets | 99% complete within upstream deadline | 1% unexpected parser failures |
| Persistence | Successfully parsed, validated results | 99.9% durably committed or identified as completed duplicates | 0.1% failures; zero accepted partial reports |
| Correctness | Every frozen canonical and claimed reference case | 100% approved expectations on each release | No correctness error budget |
| Admin operations | Authenticated valid operations | Record outcome and latency separately | No availability claim until instrumented |

Collect the denominator and classified outcomes at the trusted ingress and in structured
application logs. A weekly smoke check proves a point in time, not an uptime percentage.
Use `/api/health` and parser `/health` for liveness, `/api/health/ready` for web dependencies,
and parser `/ready` for temporary-storage readiness. Readiness responses disclose no
credentials, paths, database errors, or upstream response bodies. Capacity rejection is 429.

Upload UUIDs correlate browser, web and parser work. Do not log raw uploads, filenames,
character names, request bodies, database URLs, secrets or arbitrary upstream error bodies.
Record durations and terminal codes; restrict operational logs to maintainers. Configure
provider retention and access control explicitly before describing these as audited logs.

## Failure behavior and timeout hierarchy

- The parser request has a 270-second upstream deadline and a declared 300-second route budget.
  Parser phase limits are independent ceilings, not an additive promise that every phase
  can consume its maximum. Large/slow uploads can exhaust the web budget earlier.
  Persistence follows parsing and has up to three 60-second transaction attempts plus
  acquisition/retry time; milestone queries follow the commit. The 270 seconds is not an
  end-to-end completion guarantee, and enforcement of Next's declared route duration depends
  on the hosting runtime. Alert on full request duration as well as individual phases.
- A disconnected or timed-out job retains its parser slot and temporary file until the
  underlying worker exits. Cancellation is cooperative; it is not a process-kill guarantee.
- Progress is process-local and expires. A restart loses progress and requires reupload.
  Reconnecting to an existing status endpoint does not resume bytes or replay all events.
- Parser downtime fails the upload with a public generic error. Database persistence is
  transactional; retrying a completed file returns its existing report. An old incomplete
  report requires explicit maintainer reconciliation; it is never presented as a successful duplicate.
- Warmane failures preserve the last successful cache. Network bodies are size-bounded,
  redirects rejected and deadlines cover body consumption. Reports do not require fresh gear.
- PostgreSQL connections are capped at 10 per web process. Statements time out at 15 seconds;
  connection acquisition times out at 5 seconds. Account for every replica when sizing the database.

## Backup, restore, RPO and RTO

The original repository audit did not verify provider backups or restore behavior.
On 2026-09-04, an authenticated read-only Railway inspection found **no backup
schedules**. The newest listed snapshot was created on 2026-08-23; an older listed
snapshot had already passed its expiry timestamp. A listed snapshot is not proof
that it can be restored. **Provider RPO and RTO remain unverified.** Initial planning
targets are RPO <=24 hours and RTO <=4 hours, conditional on current successful
backups and a timed restoration exercise.

Before adopting these targets, the infrastructure owner must:

1. Enable and inspect encrypted PostgreSQL backups; record schedule, retention, location,
   access controls and a successful backup identifier. Choose PITR if a 24-hour loss is unacceptable.
2. Restore a selected backup to a new isolated database without changing production routing.
3. Validate migration history, schema, row counts, relationships, representative historical
   reports and numeric totals. Keep restored administration inaccessible while comparing evidence.
   Then follow [post-restore admin recovery](admin-access.md#restoring-a-backup) to invalidate restored
   sessions and recovery codes and enroll MFA again before running authenticated smoke checks.
4. Measure recovery duration and newest recovered transaction timestamp; record actual RTO/RPO.
5. Destroy the isolated restored copy only under a separately approved exact cleanup scope.

Raw combat logs are not retained for recovery. Database backup protects stored reports;
reparsing requires the uploader's original file and explicit reupload.

### Repeatable database evidence

Use `node scripts/database-evidence.mjs capture <private-output.json>` with
`DATABASE_URL` supplied through the operator's secret manager. The command takes a
repeatable-read, read-only snapshot with bounded queries. It records table counts,
row-content hashes, schema/constraint/index definitions, migration status, provenance
coverage and report totals; it does not export row contents, character names, cached
upstream errors or connection details. Existing output files are never overwritten.
Keep evidence outside the repository with restricted access.

After an isolated restoration, capture the restored database and run:

```bash
node scripts/database-evidence.mjs compare source.json restored.json
```

The comparison must pass for schema, indexes, constraints, every table's content,
migration ledger and report totals. Capture the source from the **same exported
PostgreSQL snapshot used by pg_dump** when production writes can continue; separately
timed snapshots can legitimately differ. Do not compare only table counts. The
integration test proves that changing an analytics value without changing row counts
fails verification. A logical export/restore exercise does not prove provider snapshot
recovery, PITR, scheduled retention or a production failover time.

Railway's ordinary snapshot restore stages a replacement volume on the source service;
it is not an isolated drill by default. Never apply it to production for testing.
Confirm an isolated provider-supported workflow before restoring a native snapshot.
See [Railway backup behavior](https://docs.railway.com/volumes/backups).

## Incidents and deployment failures

Stop the rollout if migrations fail. Preserve the failed migration record and inspect the
schema before using `prisma migrate resolve`. Never blindly mark a failed migration applied.
For a parser correctness incident, suspend new acceptance if required, restore the previous
application through a revert PR, identify affected parser versions and arrange reupload.
Do not silently recompute or delete historical rows.

For database outages, stop write retries after bounded attempts, keep readiness failing and
restore connectivity or the reviewed backup. For capacity incidents, inspect CPU, memory,
temporary disk and active worker count before increasing quotas. Restarted work is not durable.

## Availability investment roadmap

1. Verify backups, run restore drills, configure uptime/error-budget alerts and document service ownership.
2. Add database HA/PITR and redundant web capacity only after verifying aggregate connection budgets.
3. For durable uploads, approve encrypted temporary object storage, retention/cleanup, a durable job
   queue, idempotent workers and authenticated job status. See [ADR 0004](../adr/0004-durable-upload-boundary.md).
4. Consider multi-region only after a database failover/data-consistency design, replay testing,
   dependency analysis and explicit cost approval. DNS, Railway and database availability remain floors.

No paid infrastructure or production environment settings are changed by these proposals.
