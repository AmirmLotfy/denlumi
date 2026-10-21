# R0 correctness milestone — October 20, 2026

Owner authorized continuing the main plan after the full readiness audit. This is a bounded P8/P9 correctness milestone covering A01–A08, before broad workflow or UI expansion. The canonical main-plan phase numbers are unchanged. Work is in `<local-workspace>`, branch `main`, with no commit/HEAD and the original project untracked. Preserve this dirty tree and required ignored local runtime inputs.

The coordinator owns Stop restoration, scenario eligibility, integration, serial test execution, local migration admission and documentation. Two specialists own disjoint routine and session/state paths. Only the coordinator runs tests/builds. Supabase stays local-only. Bedrock/speech are forced off through the existing native wrapper; no AWS/account/resource/publication work is part of this milestone. YouTube upload remains paused.

## Status

**A01–A08 are closed for the bounded local software milestone.** Final domain regression, typecheck, production build and typed-browser verification passed. No full R0 or production acceptance is claimed.

- A01: six browser regressions first failed for persisted pending/synced Stop with actual missing caregiver authentication, simulated caregiver 503 and delayed caregiver response. Stop now restores before exposing controls, independently of optional caregiver loading. Storage failure stops conservatively. Two further corrected browser regressions reproduced late caregiver refresh/check responses leaking into a newly selected household; generation and household guards now reject those responses.
- A02/A06: tests-first run **0/10 pass, 10 fail**, 8.5 seconds. Failures show allowed pet reassignment, mutable history/export text, occurrence source changes, expired/suspended household inbox/delivery and disabled recipients. Specialist released to implement afterward.
- A04/A05/A07/A08: tests-first run **5/19 pass, 14 fail**, 12.4 seconds. Scope/revocation controls already passed; retry, expiry/content and display paths exposed defects. Specialist released to implement afterward.
- A03: alternate-composition tests first passed 4/17 and failed 13/17; all 17 passed after scenario cardinality/species constraints replaced fixture equality. SC03–06 retain distinct pairing/newcomer rules. SC07 coordination does not authorize a group session.

Routine history now reads stored instruction/kind/version. Rule pet/household and occurrence source/snapshot identity are immutable in both domain validation and the new local migration `20261020184746_routine_history_identity.sql` (applied successfully). A different pet needs a new rule. Legacy missing snapshot fields remain unknown, with null-safe UI; no invented history backfill. Inbox/worker checks reject expired/suspended homes and disabled recipients.

Session retries reauthorize current identity/scope before returning an immutable `operation_receipt`, with top-level session/guidance state derived freshly. Current content checks apply before guidance-continuing actions; appropriate record/pause/finish paths remain available within valid household access. Review expiry and applicability affect the brief immediately. Eight additional replay-safety tests first failed 8/8 and then passed; the focused routine/session run passed 37/37 before the later concurrency additions. One routine test setup was corrected because its first worker had already processed both queued events; that failure is not claimed as a product defect. The first late-caregiver test run had an incorrect heading expectation, corrected before claiming the subsequent two failures as defect reproduction.

Independent review then found reversed session/household locks. A real database lock regression failed with `55P03`; endpoints now lock the household before reselecting the session. A second regression exposed the same timeout-worker inversion and verifies that a pause committed while it waits invalidates the old timeout candidate. The worker now uses the same lock order and rechecks cutoff/state. A prior full run passed 164/164; the subsequent run passed 165/166 with only that newly added worker regression failing before its fix.

## Final executed checks

| Check | Actual result | Evidence limit |
| --- | --- | --- |
| `node .local/run-native.mjs npm test` | **166/166 PASS**, zero skipped, 115.8 seconds | Real isolated localhost Auth/database/domain; provider flags forced off |
| `npm run typecheck` | PASS | Static check |
| `node .local/run-native.mjs npm run build` | PASS, Next 16.3.5 | Production compilation; existing dependency advisories remain |
| `DENLUMI_EVIDENCE_DIR=.local/correctness-2026-10-20/browser-captures node .local/run-native.mjs node_modules/.bin/playwright test tests/e2e/phase[0789]*.spec.ts tests/e2e/shared.spec.ts tests/e2e/stop-restoration.spec.ts` | **37/37 PASS**, 2.8 minutes | Production app, real local HTTP/Auth/database; typed Chrome automation, no human/voice/provider acceptance |
| Local migration up | PASS, sole new migration applied | No hosted Supabase linked or modified |

Redacted results and source hashes: [correctness evidence](../evidence/phase9/correctness-2026-10-20.json). Raw logs, traces and fictional-data captures stay ignored/private. Source hashes identify tested artifacts; they do not establish feature or release acceptance independently.

## Changed files for this milestone

- `apps/web/app/console.tsx`, `apps/web/app/household-views.tsx`: Stop restoration, stale caregiver-response guards and unknown historical task kind.
- `packages/domain/planning.ts`, `routines.ts`, `records.ts`, `sessions.ts`, `state.ts`: scenario eligibility, immutable history, current authorization/content and replay/concurrency corrections.
- `supabase/migrations/20261020184746_routine_history_identity.sql`: local identity guards, no reconstructed backfill.
- `tests/routines-regression.test.ts`, `tests/session-regression.test.ts`, `tests/scenario-regression.test.ts`, `tests/e2e/stop-restoration.spec.ts`, `package.json`: regressions and default test selection.
- `docs/ROADMAP.md`, `TASKS.md`, `DECISIONS.md`, this handoff and closure evidence: truthful main-plan status and execution order.

Private raw outputs are in `.local/correctness-2026-10-20`. The task-owned production app uses port 3400 against the pre-existing isolated native stack on 55431/55432. Track and stop only that app at milestone end. Initial free disk was 8.0 GiB; do not delete unrelated files or reuse another project's runtime.

At closure, the task-owned production app and test processes exited; port 3400 has no listener. The pre-existing native stack PID 33598 was preserved. Both specialists finished; coordinator retains ownership and no successor was created. Branch remains `main`, with no commit/HEAD and the original untracked checkout intact. No cleanup of unrelated files or processes ran.

## Remaining sequence

Next main-plan slice is unfinished P8 workflows W01–W04, starting with normal household/pet/situation setup and no-case/no-plan empty states. Read the relevant product/data/API contracts before that bounded implementation; write real Auth/scope/stale-state/duplicate and browser empty-state tests first. Dependency hardening remains P9 work; none was silently applied here. Current Bedrock authorization remains unknown after expired owner login; no provider request was made in this milestone. Human accessibility/device/voice, genuine content review, policy/restore/retention and public source/video/submission gates remain open. R1/R2 remain conditional future scope.

Checkpoint tooling could not resolve the earlier Kerno analysis ID; a fresh preparation returned advisory classification without a recovery task. No Kerno recovery packet is claimed. This on-disk handoff plus the validated source manifest is the continuity record.
