# Phase 1 — household state

Completed local verification: 2026-09-22. Workspace: `<local-workspace>`. Git branch `main`, no HEAD/commit; all project files remain untracked from the initial specification workspace. The user authorized “implement next phase”, interpreted as canonical Phase 1. Phase 2 is not implemented.

## What changed

- `supabase/migrations/20260922111644_phase1_household_state.sql`: executable upgrade and fresh-install migration. Adds profiles, household status and state version, adult acknowledgement and internal-only notification preference, pet metadata and version, canonical pairs, pair contexts, mandatory case participants, private operator identities, and normalized membership-scope mirrors. Keeps old observation attribution intact through profile references.
- `packages/contracts/household.ts` and `packages/domain/household.ts`: strict schemas and authenticated owner operations for household creation, pet creation/update, case creation, adding participants, scoped grants/revocation, explicit ownership transfer and current graph retrieval. Unknown dates/history remain null; duplicate pet names are allowed.
- `packages/domain/auth.ts`, `db.ts`, `state.ts`, `providers.ts`: disabled identity and suspended/deleting household checks, including existing Phase 0 server operations and provider reservation. Existing guidance operations retain their protocol gates. Phase 1 management operations never execute a protocol or create a plan; edits remain possible when content is unavailable and cannot clear restrictions.
- `packages/content/fixtures.ts`: demo cases now have canonical pairs and unreviewed contexts. Single-pet fixtures still create no pair.
- `apps/web/lib/household-http.ts` and household/pet/case API routes: cookie-only, same-origin human management, strict bodies, bounded request rate, idempotency keys and fresh versions. These operations are not model/MCP tools. Existing household listing handles an empty or coordination-only household without pretending it has a plan.
- `tests/household.test.ts`, `scripts/prove-household-http.ts`: schema, auth/RLS, permission, failure, duplicate, concurrency and real HTTP coverage. Existing state tests no longer lower a version to restore a fixture. Browser evidence directory is selectable to preserve historical Phase 0 screenshots.
- `README.md`, `TASKS.md`, `DECISIONS.md`, `docs/ROADMAP.md`, package scripts and `evidence/phase1/`: setup, scope and actual evidence.

## Relational and authority decisions

Profiles bind one-to-one to verified Supabase subjects. Reviewer scope is not client-writable or returned by client SELECT *, and support role records are private. Neither role grants household access; a separate membership is required. Test reviewer/support records are fictional authorization fixtures, not verified professionals.

Membership scope arrays retain the specified API shape. Private normalized mirrors enforce same-household composite foreign keys, prohibit null/duplicate scope entries, and prevent deleting a referenced pet/case. Null scope means all eligible records; empty scope means none. Expiry/revocation and current auth.sessions are checked by both RLS and server authorization.

Exactly one unrestricted non-expiring active owner must match the household owner. A transfer is explicit, transactional and restricted to an existing unrestricted active caregiver. Grants use existing authenticated identities and record the inviter; no email or external invitation is sent. UI invitation acceptance and later external sharing are not implemented.

Canonical pairs sort UUIDs, reject self/reversed/duplicate pairs, and derive species from pets. Contexts bind both endpoints to actual participants in the same case and start unreviewed. A deferred constraint requires at least one case participant, including under concurrent deletion. Identity/tenant keys cannot move between households. Version counters cannot decrease.

Owner writes bind state_version and safety_epoch, lock the household, recheck authority, hash the operation and reject changed-payload retries. Pet/participant/ownership changes increment safety_epoch, stale plans, cancel pending dependent outbox work and publish an attributed change record; professional holds remain untouched. Membership changes advance state_version and are enforced on the next server request.

New household records are live-mode coordination records with no plan or approved content. The demo/live boundary remains enforced. All records created for this verification are fictional, including live-mode isolation tests. No customer data or hosted deployment was introduced.

## API surface

All mutations require a current `denlumi_session` cookie, matching Origin/Host, JSON, and `Idempotency-Key`. Existing-household writes additionally require expected_state_version and expected_safety_epoch. Pet updates also require expected_pet_version. Supplied actor IDs, modes, approvals and unsupported fields are rejected by strict schemas.

- `POST /api/households`: adult acknowledgment, nickname, timezone, en locale, internal inbox preference; returns tenant ID.
- `GET /api/households/:id/graph`: current RLS-scoped pets, cases, participants, pairs, contexts and own membership.
- `POST /api/households/:id/pets` and `PATCH /api/pets/:id`: owner-reported metadata.
- `POST /api/households/:id/cases`: one or more named pets and case roles; coordination_only.
- `POST /api/cases/:id/participants`: add another named participant; stale previous plan dependencies.
- `POST /api/households/:id/memberships`: explicit existing-identity grant with role/scope/expiry.
- `DELETE /api/households/:id/memberships/:membershipId`: revoke without deleting historical records.
- `POST /api/households/:id/owner`: explicit confirmed ownership transfer.

The browser remains the disclosed Phase 0 demonstration. This phase's deliverable is the household-state backend and schema, as specified by the roadmap; full management/onboarding screens are not claimed.

## Requirement audit and executed evidence

| Phase 1 requirement | Authoritative evidence |
|---|---|
| Executable migrations, indexes, constraints | Clean local `supabase db reset --local --yes` applied both migrations; `migration list --local` confirms 20260916084317 and 20260922111644 in local history. No hosted database was contacted. |
| Identity, membership/roles, household, pets | Real local Supabase Auth tests; profile self-read and no self-assigned authority; owner creation/update/transfer tests and real HTTP trace. |
| Canonical pairs and case participants | All species fixture regressions, single/multi graph test, canonical self/reverse/duplicate rejection, pair endpoint/case references, mandatory participants including concurrent deletion. |
| Same-household references and isolation (AT038) | Server and actual Data API/RLS read/write denial; cross-household scope/pair/case references fail; identity keys immutable. |
| Expiry/revocation (AT039) | Existing revoked/expired/scoped membership tests; current-session and disabled-profile tests; HTTP grant→read→revoke→403 sequence. |
| Caregiver restrictions (AT040) | Owner-only management rejected in domain and real HTTP. Reader writes and forbidden model operations rejected in the retained suite. No plan-advance API is exposed. |
| Authentication independent of voice (AT041) | Forged/revoked sessions rejected; unauthenticated and bearer-only requests cannot reach human management operations. No speech identity shortcut exists. |
| Reviewer/support scope (AT045) | Explicit fictional reviewer/support metadata does not allow household read; profile privilege writes are denied by Data API. |
| Duplicate/stale/failure handling | Same-key household creation and pet edit retries deduplicate; changed-body retries reject; concurrent owner writes admit one version; invalid references roll back; stale HTTP request returns 409. |
| Phase 0 preserved | Existing authentication, protocol gate, pairing, pause, stale caregiver, fresh retrieval and local stop tests passed, plus both browser regressions. |

Actual results:

- `npm test`: **33/33 passed** after the final clean migration reset; saved in `evidence/phase1/tests.tap`.
- `npm run test:household:http`: **PASS** against the production-built app and real local Supabase; redacted trace in `evidence/phase1/http.json`.
- `DENLUMI_EVIDENCE_DIR=evidence/phase1 npm run test:browser`: **2/2 passed**, desktop and 320px mobile. Real MCP retrieval, pause, stale refusal, new conversation, offline Stop and synchronization retained. Screenshots are regression evidence, not new Phase 1 management screens.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS**, including the new routes on pinned Next.js 16.3.5.
- Local database advisor, all checks at info level, fail-on warn: **exit 0, no WARN/ERROR and no missing-FK-index findings**. Remaining INFO: 14 unused indexes on the small test database and 8 intentionally policy-free, deny-by-default internal/audit tables. See `evidence/phase1/advisors.json`.
- Local database lint for public/private schemas: **no schema errors**.

The supplied pack's acceptance-definition JSON remains a specification. This handoff maps only the Phase 1-relevant requirements to actual execution; it does not mark all 75 full-product definitions passed.

## Blockers and limits

No Phase 1 blocker remains in the local backend scope. Bedrock's 2026-09-16 `ValidationException: Operation not allowed` is historical unresolved evidence, not a fresh provider result. No AWS inference or speech call was made for Phase 1. Microphone/audible playback, native Alexa, hosted deployment, real professional approval, operations, real customer onboarding, external invitation delivery, sharing and billing remain outside this evidence.

All protocols remain demo_only. The Phase 1 API cannot enable guidance, clear a hold, change a protocol approval or operate a device. The work is not production-ready or evidence of animal welfare outcomes.

## Processes, ownership and next action

Primary coordinator owns the milestone; no specialist was spawned. The task-owned production web server is stopped at handoff. Existing local Supabase containers remain running on dedicated 5543x ports; unrelated project containers were not modified. The database contains fictional test records only. `.env.local` remains ignored and no credential was added to public evidence.

Next smallest authorized-on-continuation slice: Phase 2 routing and content registry—structured intake, all SC01–SC17 routes and immutable version/digest/demo-live content gates. Begin with the routing truth table and fail-closed registry tests; do not invent practical instructions or reviewer approval. Resolve Bedrock separately when provider work is selected.
