# Phase 0 handoff

Date: 2026-09-16  
Working directory: `<local-workspace>`  
Git: repository initialized on `main`; no commit created. All project files are currently untracked because this workspace began as a specification pack.  
Scope: Phase 0 only. Phases 1–10 remain planned and unauthorized for implementation.

## Outcome

Implemented a local, fictional feasibility slice for Denlumi with:

- Next.js 16.3.5 / React 19.3.0 / TypeScript 6.0.3 and an exact npm lockfile.
- Supabase PostgreSQL/Auth running locally with distinct owner and caregiver sessions, RLS, server authorization, current-session checks, scoped membership, expiry/revocation checks, composite same-household references, and denied Data API writes.
- Six household shapes: cat-dog, cat-cat, dog-dog, single cat, single dog, and three-pet coordination. Each selects its own `demo_only` protocol; single-pet fixtures have no fake companion; the multi-pet fixture makes no group-readiness inference.
- A database transaction that records the exact fictional report, preserves actor/target direction, assertion, observed/reported time and provenance, creates a scoped hold, increments `safety_epoch`, stales the plan, cancels old outbox work, and publishes a household handover.
- Authenticated Streamable HTTP MCP using protocol `2025-11-25`, with stateful session negotiation, Origin/Host validation, bearer authentication, and a fixed tool whitelist. Human observation confirmation is deliberately absent from MCP.
- An Alexa-style browser simulation that retrieves current database state through actual MCP calls. It is labelled as a simulation and does not claim native Alexa access or a physical device.
- A synchronous local Stop that cancels current/queued audio and pending work, latches visibly without network/model access, records `pending` locally, and later re-reads current state before synchronizing a server pause.
- A Refero-grounded responsive interface: neutral white/graphite surfaces, vermilion CTA, dark-red Stop/restriction treatment, system fonts, no green or purple tokens, named pet lanes, attributed handover rows, and no copied assets.

## Required proof and actual result

| Proof | Actual result |
|---|---|
| Authentication | **PASS locally.** Real Supabase sign-in was exercised. Forged tokens, revoked sessions, expired grants and direct Data API reuse after sign-out were rejected. |
| Household isolation | **PASS locally.** Server reads, direct RLS reads, writes, pet/case scopes, and composite references were tested across distinct tenants. |
| MCP request | **PASS over real local HTTP.** `initialize` 200, initialized notification 202, `tools/list` 200 and authenticated `tools/call` 200 using protocol `2025-11-25`; see `evidence/phase0/http-flow.json`. |
| Bedrock request | **BLOCKED after a real AWS request.** `us.amazon.nova-micro-v1:0` in `us-east-1`, one request, `maxTokens=96`, no SDK retry: HTTP 400 `ValidationException: Operation not allowed`. No model output was shown or claimed. Database-template fallback remained explicit. |
| Current plan | **PASS locally.** The browser and HTTP proof retrieved the selected fixture, exact protocol status, participants and safety epoch through MCP. |
| Observation pauses guidance | **PASS locally.** A fictional draft increments epoch 1→2, stales the plan and creates a clarification hold before human confirmation. Confirmation is a separate authenticated human-only action and cannot clear restrictions. |
| Stale caregiver | **PASS locally.** A caregiver bound to epoch 1 received HTTP 409 `STALE_STATE` after the pause. Concurrent pause attempts allowed one commit and refused the stale contender. |
| Fresh conversation | **PASS locally.** A new conversation with no chat history retrieved epoch 2 and the pause reason through a new MCP session. |
| Local Stop | **PASS locally.** Unit tests prove synchronous cancellation despite audio/storage failures. Browser offline emulation showed “Stopped on this device. Household update not yet synchronized”; reconnect committed the pause. Measured handler time in one browser run was 5.7 ms; this is one observation, not a p95. |
| Speech feasibility | **PARTIAL PASS.** Polly returned 62,012 bytes of 16 kHz PCM; Transcribe returned “Fictional Dinlumi connection test.” Typed controls are complete. Human microphone capture and audible playback were not tested, so full voice acceptance remains open. |

## Tests actually run

- Clean local migration reset: migration applied from scratch, then seven `demo_only` protocols seeded; no approvals seeded.
- `npm test`: **19/19 passed** after the clean reset. Coverage includes local Stop, provider fallback/budget, authentication/session revocation, RLS isolation, all six household shapes, idempotency mismatch, stale/concurrent writes, scoped/expired/revoked access, negation/uncertainty/timestamps, forbidden model tools, demo/live/locale/revocation gates, composite references and rollback.
- `npm run test:browser`: **2/2 passed**. Desktop flow and 320px multi-pet flow passed, including the real MCP sequence, pause, stale refusal, fresh conversation, offline Stop and no horizontal overflow.
- `npm run test:http`: **PASS**. Redacted trace in `evidence/phase0/http-flow.json`.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS** on Next.js 16.3.5 after correcting the local environment launcher.
- `npm run providers:probe`: Bedrock **BLOCKED**; Polly **PASS**; Transcribe **PASS** with the limitations above.
- Supplied build-pack validator: **17/17 specification consistency checks passed** in an isolated temporary Python environment after installing its missing `jsonschema` dependency. The validator explicitly does not test the application, live providers, database/RLS execution, rendered accessibility, native Alexa publication, or real-animal outcomes.
- Browser visual inspection: desktop paused state, mobile entry and mobile workspace compared against `docs/DESIGN_REFERENCE.md`; no actionable reference drift remained.

## Database and migration boundary

The Phase 0 migration is intentionally a thin slice, not the 37-entity product model. It includes the tenant root, membership, pets, case participants, immutable demo protocol versions, plan binding, observation/hold/handover, audit/outbox, idempotency and provider-budget records needed for the proof.

Every exposed table has RLS enabled. User access is read-only through RLS and requires an existing current `auth.sessions` row plus an active membership and unexpired fictional household. Consequential writes use server-only transactions and recheck the auth session, membership, household/case/pet scope, plan revision, home version, safety epoch and protocol version/status. Later migrations must retain these checks, add the remaining logical entities in bounded phases, run database advisors, and preserve same-household composite references. No hosted migration was run.

Demo/live isolation is structural: P0 schema forbids an `approved` protocol row, a demo household must be fictional, the demo entry point is local-only and server-enabled, and content checks reject `demo_only` from live mode, wrong locale, revoked content or stale dependencies. There is no client override or reviewer-impersonation path.

## Decisions

The short decision record is [DECISIONS.md](../DECISIONS.md). The most consequential choices were to keep npm because the installed pnpm launcher was broken, pin MCP SDK 1.30.0 to the required `2025-11-25` protocol line, use local Supabase rather than creating a hosted project, preserve model failure as a visible blocked state, and let human UI confirmation exist outside the MCP/model tool surface.

## Known blockers and evidence limits

- Bedrock invocation remains blocked by the AWS account/provider state. Model discovery and a valid AWS session do not substitute for a successful Converse response.
- Browser microphone capture, push-to-talk streaming, audible Polly playback, speech interrupt latency across supported devices, names/ambiguity handling, and provider retention settings are not verified.
- This is local proof. No Vercel/Supabase/AWS infrastructure deployment, hosted RLS check, native Alexa add-on/account linking, physical Amazon device, notification worker, S3 export, professional sharing, billing, public domain, competition submission, customer data or real-animal session exists.
- The schema covers only the Phase 0 proof. It is not a production migration or the full model.
- Browser screenshots and software tests do not establish animal welfare or professional content approval. Every protocol remains `demo_only`.

## Processes and ownership

The local Supabase containers remain running on the dedicated 5543x ports. No app dev server, browser automation process, build, test, provider probe or agent-owned task should remain running at handoff. The last clean reset contains fictional test records from the verification suite only; anonymous demo data is disposable.

## Next smallest task

Resolve the Bedrock `Operation not allowed` account capability without changing the working MCP/database fallback, then rerun the single bounded Converse request. Do not start Phase 1 until the user explicitly authorizes it.
