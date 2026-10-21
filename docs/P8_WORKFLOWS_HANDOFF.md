# P8 W01–W04 workflow continuation — October 20, 2026

## Authority and identity

Owner explicitly requested W01 household setup and empty states, then the remaining P8 workflows. Coordinator owns integration and serial verification; two specialists implemented session and routine components with disjoint files. Work remains in `<local-workspace>`, branch `main`, unborn HEAD, original project untracked. Preserve all dirty/ignored local runtime inputs. No publication, provider account changes, hosted Supabase or new spending was authorized. YouTube upload remains paused.

## Implementation — locally verified

- **W01:** `/household` is independent of a plan-bearing brief. Existing local accounts can create a household, add/edit owner-reported pets, choose situation participants/roles and record intake. No-pets/no-situation/no-approved-module states retain useful coordination. Single-pet setup has no invented pair. The existing sample console links to management. No new signup/email provider is configured.
- **W02:** explicit checkpoint, software pause, freshly validated human resume, finish and append-only corrections, including corrections to finished session records. Owner review remains separate from caregiver/sitter operation. Starter/reporter checks govern displayed controls and server authorization remains authoritative. Persisted local Stop blocks guidance continuation. Unchanged failed requests reuse their idempotency key.
- **W03:** owner rule creation/editing with explicit timezone/schedule/status, occurrence generation, attributed claims, performed-time reports and own append-only corrections. Pet identity and occurrence history remain immutable. Conflict, stale state, outage and read-recovery states are explicit. Scoped rule-list GET discloses the current authenticated reporter.
- **W04:** pet editing, owner household settings, full list-based home resource/access/responsibility editing, read-only home records for accepted caregivers, local scoped grants, exact-revision adult acceptance and revocation. No external invitation is sent. Recipient scope labels disclose names/species/title only, not private reports, before acceptance. Six active pets and four active/pending adult memberships are the R0 server limits.

New access is pending. Regrant resets acceptance and increments `grant_version`. Acceptance requires `adult_acknowledged:true` and **`expected_grant_version`** and rechecks current household eligibility under lock. A stale consent cannot accept expanded access. Ordinary RLS reads require accepted membership; the recipient-bound pending-grant index exposes only consent metadata. Two CLI-created migrations applied locally: `20261020193618_p8_membership_acceptance.sql`, `20261020194324_p8_grant_revision.sql`. No history or legacy acceptance was synthesized.

Home replacements append a new home version, preserve prior versions and stale dependent reviews. New responsibility assignments recheck active/accepted membership, identity, role and pet/case scope. Household timezone edits do not silently change explicit routine timezones. Read and write request budgets are separate; the consequential-write limit stays 30/minute.

The existing design/reference lock in `DESIGN_REFERENCE.md` and creator context in `.impeccable.md` remain the build target: neutral/charcoal/vermilion, familiar labels, flat boundaries, progressive disclosure and 320px reflow. No new artwork, fonts, component library or stack migration. Optional management sections load their record data on first opening.

## Tests-first record

- Session UI: one missing-checkpoint case reproduced after establishing a real active session; the initial long eight-case run was interrupted after that meaningful failure. Do not claim all session cases ran red.
- Setup/routine browser packet: initial **0/8 pass**, missing index fields/page and rule-list GET/UI. Later cases added for full home access, read recovery, finished correction and primary caregiver operation were written before their implementations; those additions were not all executed red.
- Membership acceptance: **0/3 pass**, demonstrating pending household reads, retained acceptance after regrant and suspended-household acceptance. Initial post-fix focused run **3/3 pass**.
- Responsibility scope: **4/7 pass**, three new assignment eligibility failures before fixes. Later focused run **7/7 pass**.
- Stale expanded grant: **0/1 pass** before grant-version enforcement. Pet pilot limit/case-scoped assignment: **0/2 pass** before fixes. The original pet-limit failure stops before that test's later caregiver-limit assertion; do not claim a separate caregiver-limit red execution.
- First integrated domain run **173/174 pass**; sole failure was a historical fixture expecting pre-acceptance reads. It now verifies refusal, recipient acceptance and subsequent access rather than weakening the new rule.
- First setup/routine green browser selection was interrupted after detecting a routine test baseline-read race and an exact select-label locator issue. Those were test issues, not product defects. Preserve private raw logs; do not replace the historical record with a single fabricated clean run.

A later partial 60-case run exposed an invalid test attempt to scope the owner (the database correctly refused it) and a real mobile header overflow after adding management navigation. The test now starts as an actual caregiver. Browser measurement reproduced 339px document width at a 320px viewport; header wrapping corrected it to 320px with zero overflowing elements. The final full 60-case run below passed after both corrections. Agent/screenshot inspection remains AI evidence, not human usability acceptance.

Raw logs/screenshots/traces remain ignored under `.local/p8-workflows-2026-10-20` and `test-results`.

## Final executed checks

| Command | Actual result | Limit |
| --- | --- | --- |
| `node .local/run-native.mjs npm test` | **176/176 PASS**, zero skipped; 131.4 seconds | Unit checks plus real isolated localhost Auth/Postgres/domain integration |
| `npm run typecheck` | PASS | Static verification |
| `node .local/run-native.mjs npm run build` | PASS, Next 16.3.5 | Production compilation; dependency advisories remain |
| Typed production browser suite (`phase[0789]*`, `shared`, `stop-restoration`, `p8-*`) | **60/60 PASS**, 4.2 minutes | One full final run; 23 new P8 cases plus 37 prior cases; real local HTTP, injected outages explicitly simulated |
| `node .local/run-native.mjs npm run test:household:http` | PASS | Real local Auth/HTTP, pending acceptance and owner/scope/version boundaries |
| `node .local/run-native.mjs npm run test:phase23:http` | PASS | Real local plan/review/handover contracts |
| `node .local/run-native.mjs npm run test:phase45:http` | PASS | Real local session/routine/internal-job/MCP contracts |
| `supabase db lint --local --level warning --fail-on warning` with the isolated native home | PASS, no schema errors | Local typing/schema lint, not a complete security audit |

Redacted results and 34 source hashes are in [workflow evidence](../evidence/phase8/workflows-2026-10-20.json). The hashes identify the tested source; they do not independently prove feature or release acceptance.

## Files changed

- New management UI: `apps/web/app/household/page.tsx`, `household-workspace.tsx`, `home-editor.tsx`, `home-record.tsx`, `membership-manager.tsx`, `routine-manager.tsx`, `workflow-section.tsx`; `apps/web/lib/workflow-http.ts`, `coordination-types.ts`.
- Integrated views: `apps/web/app/console.tsx`, `planning-journey.tsx`, `globals.css`; read/write budget separation in `apps/web/lib/household-http.ts`.
- Domain/contracts: `packages/domain/coordination.ts`, `household.ts`, `planning.ts`, `routines.ts`; `packages/contracts/phase23.ts`, `phase45.ts`. General session actions still reject finished state; only append-only observation corrections additionally accept it.
- HTTP: household index, membership-list GET, routine-rule-list GET, new household-settings PATCH. These are authenticated human surfaces, not added model/MCP permissions.
- Local migrations: the two named above. They require acceptance for RLS reads and add monotonic grant revision; no remote resources changed.
- Tests: `tests/p8-coordination.test.ts`, the three `tests/e2e/p8-*-workflows.spec.ts` files and the historical membership test in `tests/household.test.ts`; default selections in `package.json`.
- Updated HTTP examples: `scripts/prove-household-http.ts`, `prove-phase23-http.ts`, `prove-phase45-http.ts`; their redacted real proof outputs in `evidence/phase1/http.json`, `phase23/http.json`, `phase45/http.json`.
- Documentation: this handoff, README, TASKS, ROADMAP, DECISIONS and phase/audit crosslinks. No dependency version or lockfile changed.

## Ownership and next task

Coordinator remains accountable; both specialists have finished. No successor or recurring automation was created. All task-owned test/probe/app processes exited and port 3400 has no listener. The pre-existing isolated native Supabase stack PID 33598 remains running. No unrelated files/processes were deleted or stopped. Branch remains `main` with no commit/HEAD and the original untracked checkout intact; no public push or deployment occurred.

The next smallest main-plan task is **P9 scoped dependency/security hardening** for the audited pinned packages, followed by meaningful compatibility regression. W01–W04 software workflows have local evidence; P8 human-observed usability and actual content-review acceptance remain open. Do not call the entire phase or product production-ready.

## Open boundaries

This is local fictional/software verification. No real animal-handling protocol is approved. No provider, human usability, screen-reader/device/voice or production acceptance follows from automated counts. P9 dependency advisories and operational/privacy/retention/restore gates remain. P6 Bedrock authorization is still unknown after the expired owner login; no AWS request is part of this milestone. P10 film review, paused upload, public source reconciliation and submission remain open. R1/R2 require their own gates and scope.

Kerno registered this handoff and produced a checkpoint, but its recorded `cwd` is the plugin runtime directory rather than the actual Denlumi workspace. Do not treat that packet as verified for resumption without reconciling cwd. The explicit workspace identity above and the validated 34-file source manifest are the continuity authority.
