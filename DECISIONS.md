# Decisions — Phase 0

## Phase 6/7 closure refresh — 2026-10-01

- Clear transient household content and media immediately on leave, even if logout fails. Keep a visible retry; reject delayed reads at the household/generation boundary. No unsaved draft or voice provenance carries into a new sample.
- Logout is same-origin and validates/revokes supplied tokens through local Auth, without requiring an owner session that may already have been revoked. Accept the pinned SDK's inactive/missing-session errors; retain genuine Auth outage failures. Resource reads/writes still require live authentication.
- Enforce the canonical six MCP calls per turn across model and fixed reads, reserving final current state and selected detail retrieval. Do not increase the cap to accommodate the previous five-call model loop.
- Close local Phases 6/7 with explicitly deferred Bedrock, human voice, operational and content/release gates. Today's expired AWS session does not justify repeated inference attempts. No new migrations/deployment or hosted Supabase action.

## Phases 8 and 9 — authorized local work, 2026-09-23

- The user authorized full Phase 8/9 work after Phase 6/7 local closure. Supabase remains unlinked and local-only. Do not promote any protocol beyond `demo_only`, claim professional acceptance, deploy, or operate a physical device.
- Phase 8 Today reports are explicit authenticated human records with optional notes and no inferred physical completion. Two conflicting caregivers leave the occurrence uncertain. Phase 9 local Stop timing is reported only for the tested offline Chrome software path, not for devices or audible output.
- Preserve the earlier Refero-derived neutral, white/gray/system-font design with one vermilion action accent. The Phase 8 comparison and rejected patterns are recorded in [docs/PHASE_8_DESIGN_LOCK.md](docs/PHASE_8_DESIGN_LOCK.md). No green or purple palette.
- Distinguish an owner-reviewed fictional plan from qualified professional protocol approval. New sample SC05 preserves newcomer-cat direction and has its own demo content ID.
- Today/Pets/Home/History are authenticated current-state views. Home editing creates a versioned reported record and stales the earlier review; it never verifies a physical barrier/resource. History discloses that its observations cover only the selected case.
- The Phase 8 browser journey invokes existing human-only management APIs with a fresh state check. It separates owner plan review, owner and Sam exact handover acknowledgment, preflight, explicit start, draft and human confirmation. A failed post-write refresh is reported as saved-but-not-refreshed, never as a refused write. Sam's sample cookie is used only by dedicated caregiver planning/acknowledgment routes; the owner cookie cannot impersonate Sam. Multi-pet coordination has no group-session button.
- If a current planning read fails, hide cached review, handover, draft and preflight controls until a fresh read succeeds. Keep local Stop available. A visible error alone is insufficient because it leaves stale decision controls on screen.
- A new conversational check-in clears the previous answer before its current-state request. Failed turns cannot leave an old answer displayed as the result of a fresh question. Loading-label timing is separate from answer and audio latency.
- Test app/database failure by restarting only a task-owned local app against a nonexistent local database name, then the valid one. Do not stop the shared Supabase service or claim a hosted recovery result from this drill.
- Scope the current brief's plan, participant, handover, observation and hold reads by both household and case before RLS evaluation. A case-only plan lookup bypassed the leading household column of its composite index and timed out under the grown fictional local fixture set; the household predicate preserves authorization and makes the existing index usable. This is a local reliability fix, not a production latency guarantee.
- Serialize the provider budget by actor across households before reserving a potentially paid call. Store only app-measured speech units for new Polly/Transcribe requests, not the text or raw audio; do not infer dollar cost from those units. Demo access expires at 24 hours, while primary-data purge and a published retention policy remain separate open gates.
- Keep deletion available to a freshly authenticated, unrestricted owner even when a demo household has expired. This exception applies only to the deletion request; normal reads, exports and other writes still deny expired access. Anonymous demo sessions may no longer be recoverable after 24 hours, so automatic cleanup and a published retention policy remain open.
- Newly browser-created fictional demos require an explicit retention acknowledgment in the API request; the entry screen discloses 24-hour access and local primary-cleanup eligibility after seven days. A local migration records the timestamp and due date. Older unconsented samples are excluded. The one-shot cleanup tool defaults to read-only counts and applies only to one exact household ID; it reuses the disabled-first verified deletion job. No scheduler, hosted backup erasure, general customer policy or anonymous account recovery is claimed. See [docs/PHASE_9_DEMO_RETENTION.md](docs/PHASE_9_DEMO_RETENTION.md).
- The cleanup tool accepts an explicitly bounded 1–20-row local batch. It selects only due consented fictional demos and rechecks each row under lock before deletion; older unconsented fixtures remain excluded. A later positive CLI test restricted selection to named task-created IDs and verified that named unconsented and unlisted due homes were untouched. An unfiltered all-due CLI run and continuous operation are not claimed.
- Aggregate dry-run counts distinguish ready, failed, pending, stalled and active-processing demo cleanup jobs. A failed exact-ID operation exits nonzero and is retried only after the cause is corrected. The local CLI drill proves one failed-then-retried task-created demo; it does not establish a running scheduler or hosted backup erasure.
- Expired fictional demos expose only owner-scoped version/epoch preparation for deletion when the browser retains a household reference and the owner has a valid session. The existing deletion request still requires recent authentication; normal expired reads stay denied. This is not anonymous account recovery, because anonymous samples have no password and stale or lost sessions cannot satisfy fresh authentication.
- Protocol withdrawal reconciliation must invalidate reviewed plans even before any session starts, cancel prior-epoch prompts, and leave an audit/handover trail. A provider/content administrator UI or reviewer identity must not be invented.
- The Phase 9 restore drill is limited to a clean application-scope `public`/`private`/`auth` schema restore in a separate local database. The attempted whole Supabase-platform restore had auxiliary-object errors and remains unproven. Evidence is [evidence/phase9/restore.json](evidence/phase9/restore.json).
- Validate native browser zoom with a temporary task-owned Chromium extension using `chrome.tabs.setZoom`, not a CSS zoom substitute or the user's active browser tabs. The passing 200% desktop probe covers local fictional decision screens and Stop only; human screen-reader and supported-device acceptance remain open. See [evidence/phase9/native-zoom.json](evidence/phase9/native-zoom.json).
- The 12-sample localhost latency probe is not a production SLA. Its prior longer attempt returned one unexplained 503, and live audio/device p95 targets remain unmeasured. See [evidence/phase9/latency.json](evidence/phase9/latency.json).
- Newly acknowledged fictional demos receive a high-entropy deletion-only code once at creation. Store only its digest; possession can delete only that exact expired fictional household before its seven-day cleanup date. It grants no account, plan, history or guidance access. A failed primary cleanup stays disabled and may reuse the same request; successful deletion removes the code. The holder risk is disclosed in the UI. Older unconsented samples receive no code. Local domain/browser security and layout checks are in [evidence/phase9/deletion-recovery.json](evidence/phase9/deletion-recovery.json); backup erasure and human usability remain unverified.
- The specification's 30-day operational-metadata window is a proposal, not a blanket deletion rule. A read-only localhost inventory found no selected rows older than 30 days and identified outbox/delivery and deletion-request/code dependencies. Do not implement a purge until a table-by-table policy covers unresolved jobs, retry keys, safety audit, provider cost reconciliation, deletion receipts and backup expiry. See [docs/PHASE_9_METADATA_RETENTION_PROPOSAL.md](docs/PHASE_9_METADATA_RETENTION_PROPOSAL.md).

## Phases 6 and 7 — locally closed with deferred acceptance, 2026-09-22

- The user authorized closing local Phase 6 and 7 implementation while explicitly deferring checks that cannot yet pass. The closure is documented in [docs/PHASE_6_7_CLOSURE.md](docs/PHASE_6_7_CLOSURE.md); it is not a declaration of provider, human voice, professional, hosted or release acceptance.
- On 2026-09-28, the renewed AWS identity succeeded but Nova Micro remained `NOT_AUTHORIZED` in `us-east-1`. Keep Phase 6/7 locally closed with Bedrock-driven MCP and human microphone/audible acceptance deferred; do not repeat a paid inference while read-only authorization is unchanged. The current checkout passed 102/102 local tests, production build, both authenticated HTTP proofs and 3/3 focused browser tests. Supabase stays local-only.
- A model response counts as a successful model-driven MCP loop only after an allowed, scoped HTTP tool call succeeds. A no-tool response is labeled separately. Private summaries include factual recorded plan inputs and step provenance, with limits on historical step-state reconstruction disclosed.

- Implement bounded conversation/voice and private records/export/sharing locally. No hosted Supabase linking, migration or deployment is permitted.
- Conversation actions use real HTTP MCP. Model arguments must remain inside the selected household and case, even if the person belongs to multiple homes. Model output never becomes practical guidance or human authorization.
- Observations use explicit human identity, direction, assertion and time review. Similar names, aliases and pronouns are never automatically resolved into attributed facts. Raw words are preserved; an unknown observation time stays unknown.
- Push-to-talk records mono 16 kHz signed little-endian PCM for at most 15 seconds in browser memory. The authenticated server streams it to Transcribe and retains no raw audio. Unsaved transcripts live in component memory with a 15-minute timer; explicitly saved observations follow record retention. Denlumi cannot assert AWS retention configuration without provider evidence.
- Bedrock and speech budgets and credentials remain server-side. The earlier expired AWS session was renewed; Polly/Transcribe now pass actual requests, while Nova Micro remains `NOT_AUTHORIZED`. Typed/manual controls and local Stop remain independent.
- The resumed check used the account root identity outside AWS Organizations. Do not add IAM policy, change billing, or swap models without evidence those changes address the denial. A support case draft is ready; no case was submitted because Support API access requires a premium plan and the browser Support Center requires sign-in.
- The opt-in live browser speech check uses a locally synthesized fictional WAV as Chrome microphone input. Real Transcribe, Polly, browser playback and offline Stop passed. This does not establish human microphone or audible acceptance.
- Official provider references checked: https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use-client-side.html and https://docs.aws.amazon.com/transcribe/latest/dg/streaming.html . Existing pinned SDKs are retained.

- Build Phase 0 only. Plan all canonical phases in docs/ROADMAP.md. The QA pack's P0 labels are test priorities, not permission to implement every feature.
- Keep the selected Next.js/TypeScript, Supabase Auth/PostgreSQL/RLS and Bedrock Converse stack. Use isolated local Supabase containers for fictional proof; no deployment or hosted project creation.
- Use npm with exact direct versions and package-lock.json; use `npm ci` for immutable installs. Existing pnpm launcher is broken; no stack change is needed.
- Pin MCP SDK 1.30.0 to test the pack's 2025-11-25 wire protocol. Official SDK v1 remains a maintained compatibility line; a v2/protocol upgrade requires a separate recorded decision.
- Only server-created fictional tenants can use demo content. No live practical instructions or professional approval. Keep caregiver read-only plan intent separate from human observation confirmation.
- Real Supabase anonymous authentication powers the sample entry. Sessions and membership are checked on every request; this is local demo authentication, not completed customer onboarding or Amazon account linking.
- User's no-green/no-purple request supersedes pack brand tokens. Follow docs/DESIGN_REFERENCE.md using system fonts and no copied reference assets.
- Fresh conversations retrieve state through actual authenticated HTTP MCP. Template fallback is labelled; a blocked model is never reported as live success.
- Provider calls are bounded, default disabled in the app, no automatic retry, short output and a database call budget. No new paid resources or subscriptions.

## Phase 1 — authorized 2026-09-22

- Interpret “implement next phase” as Phase 1 in the canonical roadmap. Preserve Phase 0 evidence; do not implement Phase 2 routing or practical protocol content.
- Add an executable migration for identity, household status/version, pet metadata, canonical pairs, pair contexts, and mandatory participants. Profile UUID equals the verified Supabase auth subject so existing attribution remains intact.
- Keep membership scope arrays as the contract, with private normalized mirrors and composite foreign keys for actual referential integrity. No reviewer/support role implies household membership.
- Owner management APIs require a same-origin authenticated app cookie. They are absent from MCP. Grants apply to existing authenticated identities only; no external invitation or email is sent. Ownership transfer requires an explicit confirmation and an existing unrestricted caregiver.
- New household records use live mode with coordination-only cases, no plan, and no protocol approval. Mode is server-controlled. Demo fixtures still expire and remain fictional/demo_only. This is local backend evidence, not customer onboarding or deployment.
- Pet/participant/ownership changes monotonically advance the safety epoch and stale existing plans; membership changes advance the separate state version. Private records and holds remain intact. A pair context starts unreviewed and never implies group readiness.
- Database constraints, server checks and actual Auth/RLS/HTTP tests are the Phase 1 deliverable. Keep the existing Refero-derived interface and color choices; defer broader management screens to their planned product slice.
- Current Supabase RLS documentation checked 2026-09-22: https://supabase.com/docs/guides/database/postgres/row-level-security . Read-only table grants, private authorization helpers, strict current-session checks and explicit policies are retained.

## Phases 2 and 3 — authorized 2026-09-22

- Implement the canonical Phase 2 routing/content registry and Phase 3 plan/handover slice together. Stop before Phase 4 sessions.
- Supabase work is permanently local for this project until the user supplies a dedicated project and explicitly changes this decision. Do not link a project, push migrations, create hosted resources, or deploy. Migration filenames are executable local source artifacts only.
- Route from the canonical SC01–SC17 definitions and current case participants. Preserve structured answers and unknowns. Reported professional or urgent restrictions can only stay level or become more restrictive.
- Keep the seven supplied protocol fixtures `demo_only`. The lifecycle schema can represent future review, but an `approved` state is impossible without an active, in-scope reviewer and an exact digest review. No reviewer or approval fixture is seeded.
- Treat protocol definitions, review evidence, sources, reviewed plan content, handovers and acknowledgements as immutable history. Only one-way invalidation/supersession fields may change.
- Bind each plan digest to case participants, intake, home version, protocol digest, locale and safety epoch. Home, intake or participant changes stale the plan and review, supersede the old handover, cancel queued work and advance the safety epoch.
- Require each adult member to accept their membership before exact handover acknowledgment or ownership transfer. Acknowledgment proves only that the stored handover digest was read.
- Keep Phase 2/3 management routes same-origin, cookie-authenticated and human-only. MCP remains unable to approve content, review/advance a plan, acknowledge on a human's behalf, clear restrictions, share, invite or operate devices.
- The broader browser management inventory remains Phase 8. Phase 3 adds the complete backend/API vertical slice and retains the existing disclosed Alexa-style demo visual system without green or purple.

## Phases 4 and 5 — authorized 2026-09-22

- Implement explicit session and routine coordination APIs on the existing reviewed-plan foundation. Keep the broad Today/History/session screen inventory in Phase 8; validate the Phase 4/5 product contract through authenticated HTTP, real MCP, database transactions and the existing responsive simulation.
- A session begins only through an authenticated human HTTP action after fresh reviewed-plan, handover acknowledgment, protocol, participant, home-version, safety-epoch, scope and hold checks. MCP can preflight and record a draft, but cannot start, confirm, resume, finish or advance a session.
- Keep one unresolved session per household. Time is display/checkpoint metadata only and never advances a plan. A lost heartbeat changes software state to `interrupted`; resuming is an explicit human action after the full eligibility check.
- Draft observations preserve exact report text, actor/target, assertion, observation/report times, source and a context snapshot. Confirmed structured concerns atomically advance the safety epoch, pause the session, stale the reviewed plan, cancel dependent plan work, create a scoped hold, publish a handover, queue an internal event and audit the change. Corrections append and never silently clear a hold.
- A manual software pause does not manufacture a professional restriction. Protocol withdrawal has a separate worker path that pauses the bound session while retaining its historical protocol identifier.
- Routine rules are owner-entered and limited to nonmedical coordination kinds. No model-authored prescriptions, inferred feeding/ingestion, automatic progression or duplicate completion exists. Occurrences use deterministic IANA-zone wall-clock keys; DST gaps choose the first valid minute and overlaps choose the first occurrence.
- Conflicting caregiver task reports remain independent and attributed. Corrections append. The effective task state becomes uncertain on disagreement and does not count multiple reports as multiple actions.
- Phase 5 delivery is an internal inbox only. The one-shot worker rechecks safety epoch, expiry, notification preference and active accepted membership; stale work cancels. Success, failure and uncertain outcome remain distinct. Email/SQS/Lambda/EventBridge and all external sending are unconfigured and unclaimed.
- Hosted Supabase remains permanently prohibited under the user's standing instruction. All migrations and evidence run only against the unlinked local stack on `127.0.0.1:55431/55432`.


## Phase 10 — authorized 2026-10-18

- Publish a separate buildless presentation site to Vercel and a sanitized MIT-licensed source snapshot to GitHub; preserve the original uncommitted checkout. The static site is explicitly not a working hosted application.
- Keep Supabase local-only under AGENTS rule 15. A fictional-only hosted alternative is prepared in docs/DEPLOYMENT_PLAN.md; no implicit override or backend deployment.
- Preserve all demo_only and actor/target, human confirmation, stale-state, same-origin and local Stop gates. Do not add roadmap features or stage real animal interactions for a deadline.
- Use the permitted Alexa+ simulation route. Current official rules allow private reviewer access, so the older public-only delivery assumption is superseded; the authorized publication path here uses public MIT source.
- Fix local setup portability by respecting the caller Docker context, creating credentials privately/exclusively and rejecting both hosted URLs and hostname-prefix spoofing.
- Record build/type/unit/public-site checks separately from unavailable fresh database, human, provider and video evidence.

- Owner route confirmed 2026-10-18: **keep Supabase local; finish after storage/runtime recovery**. The hosted alternative is unselected and unauthorized. Current 626 MiB free/default-profile absence blocks runtime startup, full regression and working-app video; no unrelated storage cleanup is implied.


## Local runtime recovery — 2026-10-19

- Preserve the selected local-only route. Use pinned official CLI 2.121.0 in ignored workspace tools with an isolated SUPABASE_HOME and experimental native Apple Silicon services. This replaces only the missing container runtime; Next.js/Supabase Auth/PostgreSQL/MCP remain the stack. No global tool/config update, hosted project, unrelated VM, prior-data deletion or old .env overwrite.
- Record native evidence separately from historic Docker and accumulated-fixture results. Existing twelve migrations and seven demo_only protocols were applied, with no professional approvals. Bedrock/speech stay disabled.
- Repair test harness defects without weakening security assertions: preserve an explicit missing session claim in the RLS regression, and close a shared browser database pool at worker teardown rather than file teardown.
- Keep fresh raw browser captures private because one-time fictional deletion codes may appear. Publish only redacted summaries and reviewed video. Repair public documentation targets and regenerate the sanitized build-pack manifest from actual published bytes.

- Browser-suite pacing honors the unchanged 12/min sample-entry budget before each test, observing requests without interception. The reconnection assertion allows auto-sync to remove the optional Retry button and still requires actual server-saved confirmation. Failed/interrupted attempts remain in the redacted evidence history.


## 2026-10-19 — continuous narration replacement

Owner paused YouTube upload, rejected Samantha and delegated an American male voice choice. Use actual Higgsfield Seed Audio with built-in Grady preset and General American direction. Keep one continuous take and retime the actual browser scenes to it, with transcript-derived captions. Preserve old export and keep replacement local until review. Do not claim human voice acceptance or actual catalog-certified accent from automated transcript checks. No cloned identity, new account or application speech evidence is inferred.


## 2026-10-20 — finish local submission film

Continue the already requested Grady/SVG edit from disk; preserve the explicit YouTube upload pause. Reuse the existing generated narration and real fictional browser capture. Keep explanatory motion graphics labeled separately from actual app outcomes. No app/backend changes, new generation, public push, site replacement or submission.

Use sentence-based captions, two-line 42-character bounds, a static transcript and user-controlled review player. Standardize scene pixel formats and final frame timing; validate actual decoded count/rate/duration, complete audio, captions and localhost playback. The final picture is 3,119 frames at 30 fps (103.966667 seconds), with a 104.0-second container; the one-frame closing-hold difference is within the documented media bound and does not cut narration, whose last caption ends at 100.14 seconds. Human listening remains open.

## 2026-10-20 — continue the main plan after audit

The owner requested the next main-plan phases and authorized continuation. Resume with bounded P8/P9 correctness closure A01–A08, prove regressions before fixes, then proceed through unfinished P8 workflows and P9 acceptance in the canonical roadmap. Do not treat the demo slice or existing passing counts as full implementation. Preserve local-only Supabase, demo_only content, human/model authority boundaries and the YouTube upload pause. R1/R2 and external delivery/account/legal actions keep their separate gates.

Keep routine pet identity immutable; creating a routine for another pet is a new record. Read saved occurrence context without substituting today's rule or inventing missing legacy history. Exact session retries retain their immutable operation receipt but expose current authorized guidance/session state separately. Acquire household locks before session locks, including timeout jobs, and recheck worker eligibility after waiting. Optional caregiver requests cannot delay a stored Stop or replace state after a household switch.

## 2026-10-20 — P8 household and caregiver workflows

The owner authorized W01–W04. Add a plan-independent `/household` coordination workspace using the existing design lock and local authenticated accounts. Keep practical guidance blocked without eligible content. Prepare only local access for an account reference supplied by its intended recipient; no external invitation is sent. New/changed grants require explicit acceptance bound to a monotonic grant revision, and pending grants cannot read household records. Preserve prior home versions, immutable routine history and append-only corrections, including finished-session corrections. Scope visible session controls to the current authenticated role, starter and reporter. Keep six active pets/four active adult grants as the R0 limit. Split record-read budgets from unchanged consequential-write limits; retain exact failed-payload keys for retries.

### 2026-10-20 — P9 scoped dependency/security hardening

The owner authorized dependency/security gap closure and all local checks. Pin Next 16.4.2 and React/React DOM 19.3.1 after maintainer October 14 advisories showed the npm audit feed was incomplete; keep MCP 1.32.1 and compatible exact sharp/Hono/source-map-js overrides. Test with checksum-verified task-local Node 22.23.3/npm 10.9.9; preserve the system runtime and existing native Supabase stack. Node's announced October 21 security update remains a required follow-up. Do not equate a zero npm audit count with comprehensive runtime/bundled-code security.

Bound JSON by streamed UTF-8 bytes; apply one actor read budget across all app-record GET routes while preserving credential semantics and an independent write budget. Bound stateful MCP admission, lifetime and cacheability; send explicit DELETE on completed app turns. Reject batches under the pinned single-message transport contract, and release transports on request abort/deadline. A transport timeout does not certify database rollback. Keep the publication artifact check read-only and selected-pattern only. See [P9_HARDENING_HANDOFF.md](docs/P9_HARDENING_HANDOFF.md) for reproduced failures, actual checks and remaining human/provider/operational gates. No hosted, public, paid-provider, destructive retention or submission action is included.

## 2026-10-21 — remaining P9 operations and P10 preparation

Keep protocol withdrawal, outbox dispatch and handover acknowledgment in household-before-child lock order; trusted workers may use validated exact IDs for isolated fictional drills. Recheck current state after lock waits. Handover acknowledgment rechecks active/unexpired household and case/all-pet scope before replay; new writes require current published epoch/digest. Bind receipts to the exact handover ID even when two digests match, preserving authorized same-target historical retries. Refuse missing/ambiguous local database URLs before constructing a pool; pure unit tests may not contact the database.

Prove application recovery only in a new task-owned local database with private temporary files and cleanup before PASS. Existing operator privileges cannot reproduce Supabase's original Auth owners or future-object default privileges; preserve existing object ACLs/RLS, exclude only DEFAULT ACL entries and declare those limitations. Do not change global roles or promote this to full-platform recovery. No retention purge until table-specific policy/retry/dependency decisions; human acceptance packet starts NOT_RUN. See [P9 operations handoff](docs/P9_OPERATIONS_HANDOFF.md).

Prepare the gated [P10 packet](docs/submission/NEXT_STEPS.md) using current official rules and precise deadline/timezone conversion. Keep the replacement film local and **upload paused**. Source reconciliation and owner watch/listen precede separately authorized public changes; form declarations and final submission remain owner-controlled. Supabase stays local-only; AWS identity expired and authorization unknown. No new provider calls/resources, practical approval, publication or submission is inferred.

## 2026-10-21 — P10 isolated source reconciliation

Prepare `.local/p10-source-candidate` from public `ae32fcb8cdd8f45996615bdf9c9addd357eb0805` and leave the older dirty publication checkout/manifest and exact Grady film untouched. Keep the sanitized diff, allowlisted archive and original-versus-export byte manifest local. Historical execution hashes remain historical; link/path redaction does not promote sanitized documents to executed bytes. Replay a separate exported source folder with fresh dependencies against the existing localhost native stack; explicitly retain clean-machine Docker as unverified. No app/provider feature or public delivery is added. Upload stays paused.

Reject ambiguous API/database URLs and multiline CLI connection fields before writing local credentials; regression failures were reproduced first. Correct README server ownership/current evidence, add Refero/GitHub/Vercel feedback, and distinguish original MIT assets from narration/third-party rights. Owner declarations and film listening remain required.

## 2026-10-21 — owner resumes submission work

The user requested "continue everything ... also submit everything for me in your internal browser". This supersedes the preparation-only upload pause for the planned Denlumi delivery; it does not provide missing personal eligibility/rights facts or bypass action-time agreement confirmation. Created Devpost draft1252467-denlumi under the signed-in account and prepared factual fields. YouTube Frameless channel selected; exact film upload waits for confirmation because the actual upload dialog accepts Terms/Community Guidelines. Official current deadline remains Oct23 22:00 Cairo. Current Node22.23.4 security patch is available; upgrade/checks run in an isolated task-local runtime before source publication. Supabase stays localhost only. Existing other hackathon entries and unrelated work remain untouched.

## 2026-10-22 — public delivery with owner-manual completion

The owner explicitly approved YouTube Terms/Community Guidelines and public upload, and asked to complete needed personal inputs manually later. Published exact Grady film to Frameless, verified Public status, anonymous metadata, real muted playback and manually uploaded English caption selection. Application source 63ea233 fast-forwarded to GitHub and selected anonymous bytes matched. Devpost saved technical fields, source ZIP, video and gallery; draft 3/5 remains incomplete. Keep personal fields blank, eligibility/terms unchecked, and final Submit project unpressed. No automatic final submission or new external action is inferred while the owner completes those inputs.
