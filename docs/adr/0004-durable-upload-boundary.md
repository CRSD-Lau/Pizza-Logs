# ADR 0004: Keep bounded streaming and reupload recovery

Status: Accepted

Author: Neil Mitchell

Last modified by: Neil Mitchell

## Context

The web service streams to one parser process; progress and admission are process-local.
Restarting either service can interrupt an upload. Database transactions can prevent partial
reports but cannot recover ephemeral bytes or a parser job after restart.

## Decision

Retain direct streaming, bounded work, cancellation-aware cleanup and atomic report persistence.
Do not introduce an in-memory imitation of a durable queue, raw-log retention or an unconfigured
storage provider. No cross-region or nine-nines guarantee follows from these code improvements.

On 2026-09-06, the owner accepted reupload after a service restart or interrupted upload as the
current recovery behavior, settling the upload-reliability decision in issue
[#75](https://github.com/CRSD-Lau/Pizza-Logs/issues/75). A durable queue, resumable processing and
staging storage are not required for this operating model. Introducing them requires a separate
request with an approved scope and infrastructure budget.

For a separately approved durable orchestration change, define: an encrypted staging bucket; explicit short retention;
deletion on every terminal outcome; job ownership/authentication; bounded queue length;
idempotent result commit; durable retry policy; poison-job handling; observability; and cost limits.
Introduce a versioned upload API additively, shadow synthetic jobs, test restart/duplicate delivery,
then migrate clients gradually. Keep direct streaming available for rollback during the transition.

## Consequences

Current restart recovery is reupload. No additional raw log is retained. HA requires an operational
design and infrastructure work beyond this repository; [service objectives](../operations/service-objectives.md)
describe database backup and recovery obligations and service targets. Accepting reupload does
not remove those obligations or make an interrupted upload resumable.
