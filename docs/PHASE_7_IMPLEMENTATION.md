# Phase 7 private-records backend

Date: 2026-09-22. Scope: local fictional database records only. This document describes implemented code; acceptance results belong in the coordinator's phase handoff after execution.

## Contracts

`POST /api/records` is a human-management endpoint using the existing session cookie, same-origin guard, request validation, no-store responses and rate limits. Mutations use an `Idempotency-Key` header. The discriminated input schema is `packages/contracts/phase7.ts`.

- `preview`: owner-only factual case snapshot plus all participants and routine reports for those pets. Captures exact text/HTML bytes, digest, provenance, destination, scope and expiry. Includes distinct observation/report times, actor/target direction, negation, uncertainty, draft/correction status, reporter IDs, historical protocol identity/status and current support state. It authors no diagnosis or practical care advice.
- `authorize`: explicit exact-content owner confirmation; authenticated session must have been created within 10 minutes. Binds owner, snapshot digest, format, purpose, verified recipient ID/address, scope and expiry. Rechecks current household version/epoch and protocol/plan metadata. Preview authorization expires after 10 minutes. Inserts and consumes a single-use authorization transactionally with the resulting private export or grant. Same-key identical retries return the prior result; altered retries fail.
- `download`: owner-authenticated attachment containing the exact preview bytes. HTML escapes all input, contains no active content and has sandbox/CSP/nosniff headers. Export bytes live in the local private database, not S3/Supabase Storage or the public directory.
- `view_share`: exact frozen snapshot for its bound, verified authenticated account. There are no public bearer URLs or reusable tokens. The grant ID alone cannot authorize access. Viewer auth must be at most 30 minutes old and a per-session viewer record expires after 30 minutes or grant expiry, whichever comes first.
- `revoke`: owner-only immediate server revocation. Every viewer request rechecks grant, household, verified identity and session. Copies already downloaded cannot be recalled.
- `list`: current owner-only private-record inventory.
- `archive`: version/epoch-bound pet archive, historical records retained, routine rules archived, unreported dependent work canceled and plans/reviews invalidated. No automatic sharing or replacement-pet advice.
- `delete_request`: fresh owner confirmation for the entire household; household access is disabled, every membership and grant revoked, guidance canceled and pending/processing outbox events canceled before cleanup begins.
- `delete_status` and `delete_process`: authenticated requesting owner can inspect or run the persisted deletion job after membership revocation. Processing requires recent authentication. Local loopback database only. The job deletes the supported household's records in dependency order and verifies absence before completion. Any unknown tenant table fails closed. Failures remain disabled, visible and retryable; processing has a two-minute recovery lease.

`draftPrivateSummary(actor, householdId, caseId)` is the only read-only helper suitable for MCP. It permits an accepted scoped member only when the case and every participant are allowed, returns a private factual draft, and creates no preview/authorization/grant/export.

## Data and authorization decisions

The migration adds immutable `professional_summaries`, `action_authorizations`, `private_exports` and `share_grants`, plus server-private viewer sessions and deletion requests. Public tables have RLS and no client policies: direct Data API reads return no rows, and mutations are revoked. Server domain functions perform current session, household, accepted membership, owner/scope and freshness checks before reading or replaying idempotent results.

Case snapshots include all participants rather than a partial pair that could distort an actor/target report. Scope records the case, exact participant IDs and source record IDs. Protocol metadata is recorded/rechecked, while unavailable guidance never blocks useful access to existing factual records. All bundled protocols remain `demo_only`.

The deletion job permits deletion through existing append-only history guards only for a privileged server transaction with a matching deletion marker and a household already in `deleting` state. Normal history mutation remains forbidden. It removes private idempotency/provider-call records, generated exports, grants/viewer sessions, observations, tasks, sessions, plans, household metadata and membership scopes. A minimal deletion receipt remains, with no private report text. Global auth/profile identity and unrelated households remain intact; this is expressly household deletion, not account deletion.

## Retention and evidence limits

Private snapshots persist until household deletion; expiry removes access but does not erase stored bytes. Grant/export expiry is owner-selected and capped at 72 hours. Primary cleanup is verified only when the job reports `completed` with `primary_cleanup_verified=true`. Historical backups, recipient-retained copies and device downloads are outside this cleanup. Backup expiry is not configured or verified here. No legal retention policy, instant backup erasure, deployed privacy service or production readiness is claimed.

No external message is sent, and no storage provider, PDF generator, professional portal, hosted Supabase project, deployment, billing or provider call is used. Verified email identity does not establish professional qualifications. The UI must explain recipient prerequisites and recent-sign-in errors honestly.

## Files and pending acceptance

- `packages/contracts/phase7.ts`
- `packages/domain/records.ts`
- `supabase/migrations/20260922175744_phase7_private_records.sql`
- `apps/web/app/api/records/route.ts`
- `tests/phase7.test.ts`

Coordinator command: `node_modules/.bin/tsx --env-file=.env.local --test --test-concurrency=1 tests/phase7.test.ts` after the local migration is applied. Thirteen database-backed tests cover factual provenance/HTML escaping; exact binding and replay; recipient/revocation/guessed IDs; fresh authentication/viewer expiry; scoped access/RLS; archive preservation; coherent primary deletion; failed-job recovery; actual expired grants/exports; session and membership revocation; ownership transfer; correction history; and protocol withdrawal. The cleanup-failure test creates and removes one empty local fixture table, so run the suite serially.

Coordinator executed the local migration, all 13 tests (within the 82-test regression run), real HTTP checks, owner and recipient browser flows, schema lint and production build. See [PHASE_6_7_HANDOFF.md](PHASE_6_7_HANDOFF.md) for exact results and remaining provider/voice gates. The specialist itself ran no heavy checks.

Official references checked for this implementation: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Supabase sessions](https://supabase.com/docs/guides/auth/sessions). Next.js route handler guidance was read from the installed pinned dependency.
