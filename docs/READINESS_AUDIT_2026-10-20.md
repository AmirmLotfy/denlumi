# Denlumi full-plan readiness audit — October 20, 2026

**The full plan is not implemented, R0 acceptance remains incomplete, the submission is unfinished, and the product is not production-ready.** A substantial fictional demonstration slice works. Passing its tests and exporting its video do not close the broader product or release gates.

This audit compared the canonical roadmap, product/welfare/protocol/data/API specifications, actual source and tests, phase handoffs, local evidence, published artifacts and current AWS authentication. Two independent read-only specialists reviewed functional completeness and security; the coordinator checked the important source paths and ran the existing regression. Findings below are source-review findings, **not newly executed exploit/browser reproductions**. No product fixes, dependency upgrades, publishing or AWS account changes were made.

## Checks actually run today

| Check | Actual result | Limit |
| --- | --- | --- |
| `npm ci --no-audit --no-fund` | PASS; 185 packages restored from the existing lockfile | No version upgrade; node_modules was absent initially |
| `node .local/run-native.mjs npm test` | **110/110 PASS**, 78.4 seconds | Real isolated localhost Auth/database/domain checks; model/speech forced off; new source findings are outside existing assertions |
| `npm run typecheck` | PASS | Static source check |
| `npm run build` | PASS, Next.js 16.3.5 | Compilation, not user/provider/release acceptance |
| `python3 tests/configure-local.test.py` | **6/6 PASS** | Fake CLI boundary output; not clean-machine replay |
| `npm audit --package-lock-only --json` | **Exit 1: five affected packages — critical 1, high 3, moderate 1** | Advisory/version matches, not proof every vulnerable feature is reachable |
| AWS CLI 2.36.29 identity preflight | **BLOCKED, exit 255: session expired; reauthenticate using `aws login`** | No current model availability obtained and no inference request sent |
| Public GitHub API | HEAD `ae32fcb8cdd8f45996615bdf9c9addd357eb0805`, dated October 18 | Public snapshot predates local runtime/test/video changes |
| Anonymous HEAD requests | Showcase 200; old MP4 200, 5,640,915 bytes | Does not verify new film publication or full playback |

No fresh application browser regression was run. October 19's 29/29 typed-browser result remains historical. October 20's film/player validation remains media evidence. The full domain suite creates fictional test fixtures; no customer or hosted data was involved. Supabase stayed local-only. The pre-existing local native stack was preserved; no new server or background task remains.

## Source defects and specification conflicts

Priority P1 means fix before claiming a complete dependable R0 experience; P2 means a correctness/consistency gap to close with focused regressions. These are review priorities, not acceptance-test priority labels from the build pack.

| ID | Priority | Finding and concrete trigger | Source / required correction |
| --- | --- | --- | --- |
| A01 | P1 | **A persisted Stop can be lost on reload.** Initial loading obtains the owner brief, then awaits optional `/api/caregiver` before restoring the stored Stop latch. A caregiver 401/503 skips restoration, leaving the owner UI with no pending/synced latch. Recording/playback guards consequently see `false`. This is distinct from the synchronous Stop button, which still has passing tests. | [console.tsx:55–59](../apps/web/app/console.tsx), voice guards at 138/145. Restore local Stop independently and before optional network work; cover pending/synced markers with missing/revoked caregiver and outage. |
| A02 | P1 | **Routine edits can rewrite historical attribution and pet-scoped access.** Moving a routine from pet A to B leaves historical occurrences/reports joined to the mutable current rule. Old A reports appear under B and a B-only caregiver can gain access to A's historical reports within that household. Current instruction text also substitutes for stored history. | [routines.ts:41,61,71,80–83](../packages/domain/routines.ts), [records.ts:63](../packages/domain/records.ts), [phase5 RLS:114–122](../supabase/migrations/20260922121837_phase5_routines_jobs.sql). Bind immutable pet/rule version/instruction to each occurrence and use that binding in reads, authorization, RLS and export. |
| A03 | P1 | **Fixture compositions became universal scenario eligibility.** SC07 accepts exactly two cats and one dog, rejecting three dogs, three cats and four-to-six pets. SC11/12 require cat-dog rather than valid single/same-species sitter/daily care. SC16 rejects an injured/ill dog because its fixture is one cat. Other SC08–16 restrictions have the same pattern. This conflicts with the scenario matrix and six-pet R0 scope. | [planning.ts:23–30,38](../packages/domain/planning.ts). Replace exact fixture arrays with explicit scenario eligibility constraints. Existing planning tests mirror fixture restrictions and need valid alternate-composition cases. No group session should be enabled for SC07. |
| A04 | P2 | **Session retries can reject previously successful work.** The shared helper checks the old expected state before idempotency lookup. After a successful pause/resume/finish changes state, the same key/body replay fails `STALE_STATE`. Confirmation/correction also validate already changed observation state before replay. | [sessions.ts:52–72](../packages/domain/sessions.ts). Recheck current identity/scope, then replay the exact operation-bound result before transition-specific predicates. Cover committed response loss and changed-body refusal. |
| A05 | P2 | **Session mutations omit household expiry.** The privileged session helper verifies active status and membership but not household `expires_at`. A still-authenticated member can checkpoint or write session records after demo access expiry, unlike normal reads/preflight. | [sessions.ts:53–64](../packages/domain/sessions.ts). Apply the active/unexpired household predicate; define any deliberately permitted safety-decreasing exception explicitly without allowing ordinary writes. |
| A06 | P2 | **Inbox and internal delivery bypass household status/expiry.** Inbox retrieval checks membership but never household eligibility. The worker checks event expiry and epoch, but not household expiry/suspension. An expired/suspended home can retain inbox access or receive new internal delivery records. | [routines.ts:87–88,103–112](../packages/domain/routines.ts). Apply consistent household eligibility at read and delivery time and test household expiry separately from event expiry. This is internal inbox behavior; no external provider is configured. |
| A07 | P2 | **An ongoing session can affirm active state after content withdrawal.** Checkpoint/observation helpers do not independently verify current protocol withdrawal/expiry/digest. Starts/resumes check more thoroughly, while ongoing status depends on the separately invoked reconciliation worker. | [sessions.ts:53–64](../packages/domain/sessions.ts). Fail closed on guidance-continuing requests using current content eligibility; preserve appropriate pause and record-only paths. Test the interval before reconciliation. |
| A08 | P2 | **Displayed guidance availability omits review expiry.** The brief query does not select `review_due_at`; its availability calculation can remain true until reconciliation even when preflight would reject the protocol. | [state.ts:16,28](../packages/domain/state.ts). Derive display eligibility from the same current criteria as server preflight. |

## Unfinished R0 workflows

| ID | Gap | Evidence / smallest completion |
| --- | --- | --- |
| W01 | **Normal household onboarding and empty states are missing.** Household creation makes owner membership, but a useful brief requires a case and plan. The household API turns missing-case/plan failures into `brief:null`, and the console presents the fictional picker. A normal no-pets/no-case/no-plan household cannot enter a useful owner workflow. | [household.ts:41–53](../packages/domain/household.ts), [state.ts:14–17](../packages/domain/state.ts), [households route:6](../apps/web/app/api/households/route.ts), [console.tsx:50–59,176–186](../apps/web/app/console.tsx). Separate household coordination from a plan-bearing brief and add setup/empty states. |
| W02 | **The browser session lifecycle stops at the demonstration pause.** No finish, permitted resume, checkpoint or append-only correction controls exist. An unresolved session blocks the next start; the user cannot close/recover it through the current UI. | [planning-journey.tsx:55–74](../apps/web/app/planning-journey.tsx), [sessions.ts:40,56–72](../packages/domain/sessions.ts). Connect explicit human lifecycle actions while preserving holds and fresh preflight. |
| W03 | **Routine management is primarily an API capability.** Today only submits done/skipped/uncertain with no performed time. It lacks rule creation/editing, task claims and report correction. Available reporter identity is not shown clearly in report history. | [household-views.tsx:26–39,74–80](../apps/web/app/household-views.tsx), [routines.ts:55–75,90–99](../packages/domain/routines.ts). Add owner-entered rules and attributed claims/reports/corrections. |
| W04 | **Pet, caregiver and home management are incomplete.** Pets is read-only; no ordinary creation/editing/situation flow, caregiver acceptance/revocation/settings UI, or full resource/responsibility editor is exposed. Home mainly appends a zone while preserving existing responsibilities. | [household-views.tsx:60–96](../apps/web/app/household-views.tsx), [household.ts:99–118](../packages/domain/household.ts). Complete the scoped management workflows rather than counting the API alone as completed UX. External invitations remain separately authorized. |

## Dependency findings

| Locked package | Audit severity | Advisory / patch boundary |
| --- | --- | --- |
| Next.js 16.3.5 | Critical aggregate | [Maintainer ImageResponse advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), fixed at 16.3.6; additional audit-listed Next issues extend below 16.3.8. Audit proposes 16.4.2. No `next/og`, `ImageResponse`, `use cache`, Draft Mode or `next/image` use was found in application/domain source. Do not claim an exploitable RCE merely from the version match. |
| MCP SDK 1.30.0 | High | [Maintainer OAuth advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h); affected below 1.31.0. The app uses a fixed local authenticated MCP boundary; the affected OAuth client path was not found. Preserve tested wire behavior when upgrading. |
| sharp 0.35.4 | High | [Maintainer librsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w); patched at 0.35.5. The final film's bundled caption renderer already used 0.35.5, but the application lockfile still has 0.35.4. |
| source-map-js 1.2.1 | High | Audit reports indexed-source-map event-loop denial of service below 1.2.2. Reachability from Denlumi user input was not established. |
| hono 4.13.8 | Moderate | Audit reports static-path decoding/middleware bypass below 4.13.11. No application `serveStatic` use was found. |

These require scoped dependency updates and compatibility/security regression, not an automatic `npm audit fix` or stack migration. No lockfile version was changed during this audit. The buildless static showcase does not run this Next.js app dependency set.

## Bedrock: current status versus historical evidence

- Target: default AWS profile, `us-east-1`, configured inference profile `us.amazon.nova-micro-v1:0`; base-model availability target `amazon.nova-micro-v1:0`.
- **Today's live result: authentication blocked**, CLI exit 255, `Your session has expired. Please reauthenticate using 'aws login'.` The availability request was not sent because identity failed. Therefore current authorization is **unknown**, not newly confirmed denied or enabled.
- `.env.local` contains `BEDROCK_ENABLED=true`. The isolated native wrapper explicitly overrides it to `false`, as it did during today's tests. No application server was listening on port 3400 at preflight. Configuration intent, effective test mode and AWS permission are separate facts.
- The last completed historical availability check returned `NOT_AUTHORIZED`; older real Converse requests returned `ValidationException: Operation not allowed`. Neither is a fresh October 20 result.
- Next provider check: owner completes AWS login, then repeat the [official read-only model availability request](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_GetFoundationModelAvailability.html). Successful availability alone does not establish the required model-driven app/MCP turn; that still needs its own bounded real invocation evidence. No IAM, billing, agreement, subscription, model or region change is justified by an expired login alone.

## Phase and release assessment

| Scope | Assessment |
| --- | --- |
| P0 | Local feasibility infrastructure implemented; successful live Bedrock inference unproved |
| P1–P3 | Substantial domain/API implementation; normal owner UX, scenario eligibility and complete coordination states unfinished |
| P4–P5 | Demonstrated session/report/pause and routine backend exist; defects A02/A04–A07 and lifecycle/routine UI remain |
| P6 | Real HTTP MCP/bounded orchestration/typed fallback exist; successful real Bedrock tool use and human voice acceptance open |
| P7 | Private preview/export, verified-recipient scoped grants/revocation, archive and primary deletion implemented locally; operational backup/retention limits remain |
| P8 | Six guided fictional sample shapes plus SC07 coordination have recorded traces; this does not prove all valid scenario compositions, normal owner workflows or human usability |
| P9 | Substantial automated hardening and current regression; source defects plus human/accessibility/device/operational gates remain open |
| P10 | Source/showcase and local 1:44 film prepared; published snapshot is old, film upload paused and final entry unfinished |
| R1/R2 | Conditional future work, not completed product |

The reviewed-content product needs engineering as well as genuine review: [planning.ts:98–104](../packages/domain/planning.ts) selects `demo_protocol_slug` and creates the same three software steps; [state.ts:28](../packages/domain/state.ts) exposes guidance only in demo mode. The real reviewer/admin publishing flow is unavailable. A signed review by itself would not turn this demo into a live reviewed-content product. Keep that work separately scoped to R1 and all current modules `demo_only`.

Other open acceptance gates are human-observed fictional usability, screen-reader and supported-device/non-audio/voice checks; provider retention and actual cost/latency reconciliation; policy-reviewed operational metadata retention; continuously operated consented demo cleanup; full-platform/backup expiry evidence and clean-machine/Docker replay. The successful native test database is not recovery of older records. These are distinct from source bugs and cannot be replaced with more automated passing counts.

Intentionally deferred work includes the real customer pilot and qualified practical modules, commerce, dedicated SC17 sensitive workflow, reviewed Arabic/RTL content, native Alexa/clients, professional portals/PDF and external delivery. Billing and hosted Supabase are not implicit readiness fixes. Hosted Supabase remains explicitly prohibited.

## Publication and submission gaps

Live GitHub HEAD still matches the separate October 18 publication checkout. Core app files checked match that snapshot, but local native setup support and later test harness/documentation fixes differ or are absent publicly. The demonstrated setup and source package need reconciliation before claiming judge reproducibility.

The public showcase and historical 2:03 MP4 return HTTP 200. That MP4 is 5,640,915 bytes; the local 1:44 Grady/SVG replacement is 7,262,243 bytes. The replacement has not been published. Owner listening/voice acceptance and explicit resumption of the paused YouTube upload remain. A public YouTube/Vimeo link, public playback check, Devpost account/form state, track/mini-challenge choices, feedback preference answers and eligibility/rights declarations are unfinished; no entry has been submitted.

[Official rules rechecked October 20](https://amazonappdev2026.devpost.com/rules): the deadline remains October 23, noon PDT, **22:00 Cairo**, and the English video must be public on YouTube/Vimeo and under three minutes. A static showcase is not the working hosted app or the required platform video. Supabase local-only is a selected boundary; use truthful source-and-video/judge setup rather than silently deploying a backend.

## Recommended order of work

1. Fix A01/A02/A03 and the A04–A08 consistency paths with focused regressions that first demonstrate each defect; keep auth/scope/protocol gates intact.
2. Triage/update the pinned vulnerable dependency set and run protocol, Auth/database and browser compatibility checks.
3. Complete W01–W04 as actual user workflows, including empty/error/recovery states and explicit lifecycle completion; validate non-fixture scenario combinations.
4. Renew AWS login and obtain separate live Bedrock/app evidence if access permits. Preserve truthful fallback if it does not.
5. Reconcile the exact tested source snapshot and judge instructions; review the film, resume publication only when authorized, verify the platform URL and complete owner submission declarations.
6. Before customer/practical release, close genuine review, human accessibility/voice, privacy/retention/restore and operational gates. Implement only the separately authorized R1/R2 scope.

Useful enhancements after correctness: one authoritative eligibility calculation for display/start/worker paths; immutable occurrence context; cross-role and cross-scenario regression matrices; explicit reporter identity and report/observation times; release-commit-bound evidence and reproducible setup; readable domain modules rather than long compressed transaction lines. Visual polish follows complete, tested workflows.

**Files changed by this audit:** this report, a redacted result summary and a short phase-handoff note only. Restored ignored dependencies/build outputs and private raw logs remain local. Product source/configuration, dependency versions, public source/site and accounts were not changed. The smallest next engineering task is A01 with reload/outage regressions; this audit did not implement it.

## Subsequent local correctness closure — October 20

After the owner authorized continuation, A01–A08 were corrected and verified with tests-first regressions, including additional late-response, current-state replay and lock-order cases. Final checks passed **166/166 domain tests**, **37/37 typed-browser tests**, typecheck and production build. See [the corrective handoff](R0_CORRECTNESS_HANDOFF.md) and [redacted evidence](../evidence/phase9/correctness-2026-10-20.json) for files, decisions, actual failed and passing runs, and limits. The findings above describe the audited earlier source; they are not the current open defect list. W01–W04, dependency advisories, human/provider/operational gates and P10 publication/submission remain open. No hosted Supabase, provider account or public artifact changed.

## Subsequent P8 software workflow closure — October 20

W01–W04 now have local implementation and integrated verification: final **176/176 domain**, **60/60 typed-browser**, three updated HTTP examples, typecheck/build and local schema lint passed. See [the workflow handoff](P8_WORKFLOWS_HANDOFF.md) for files, revisions, test iterations and limits. The earlier workflow table describes the audited source, not the current implementation. Genuine content review, human usability/accessibility/voice, dependency/security and operational/provider/release gates remain open. No hosted Supabase, public deployment, provider resource or submission changed.

## P9 local hardening closure — October 20

The owner authorized dependency/security fixes and all local checks. Final Next 16.4.2/MCP 1.32.1/React 19.3.1 and compatible transitive pins run on task-local Node 22.23.3/npm 10.9.9. Streamed JSON budgets, shared read limits and bounded MCP lifecycle are corrected, including a reproduced SDK batch-cancellation hang. Final verification passed **198/198 domain**, **60/60 typed-browser**, **5/5 isolated mocked voice**, seven existing HTTP commands plus nine new security checks, seven fictional HTTP/MCP shapes, typecheck/build, six setup tests, schema lint, selected artifact scans, local latency and database-connection recovery. The lockfile audit reports zero known vulnerabilities, but maintainer advisories also informed the final pins. See [P9_HARDENING_HANDOFF.md](P9_HARDENING_HANDOFF.md) for exact failures, fixes, evidence and limits. Recheck the announced October 21 Node security release once available. Human/provider/retention-policy/continuous-operation/backup and clean-machine gates remain open. No hosted, paid-provider, public or submission action occurred.
