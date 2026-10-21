# P9 operations continuation — October 21, 2026 Africa/Cairo

Remaining local P9 gaps were addressed and P10's submission packet prepared. **Upload stays paused.** This is local software and bounded fictional-operation evidence; human, professional, provider and full-platform acceptance remain open. Earlier [hardening results](P9_HARDENING_HANDOFF.md) and their hashes are historical snapshots, not overwritten source identities.

## Fixes and decisions

- Protocol withdrawal now acquires household locks in sorted order before plan/session children and rescans current eligible plans/protocol status after a wait. An optional validated exact-version scope lets a trusted worker drill touch only dedicated `demo_only` clones; omitted scope retains maintenance behavior. Empty/malformed/duplicate/unknown options fail before database access. No HTTP/model authority to revoke protocols was added.
- Outbox processing retains oldest-due selection and limit, but takes all selected household locks in the same sorted order before event/member locks. It rechecks cancellation and scheduling after waiting. Optional exact-event scope is trusted-worker tooling; no external channel was enabled.
- Handover acknowledgment takes the household lock before the handover/idempotency relationship, then rechecks session, membership and current handover. Concurrent withdrawal no longer forms the reproduced lock cycle. Active/unexpired household, accepted membership and exact case/all-pet scope are checked before receipt lookup; fresh writes also require a current-epoch published handover. Exact historical retries remain receipts for still-authorized actors. Receipt lookup also binds the exact handover ID, so two versions with identical text/digests cannot reuse one key as success for another target. Changed/revoked access fails closed.
- Database admission requires an explicit PostgreSQL URL for localhost/127.0.0.1 port 55432 with no query or fragment. Previously `?host=...` could override the validated URL authority in the connection parser; a missing URL could inherit ambient PostgreSQL settings. New regression children construct pools without connecting. Pure unit tests use an explicit fictional URL and forbid pool access.
- The isolated current application restore uses matching PostgreSQL 17.11 tools, a consistent exported snapshot, a random task-owned database, private mode-0700/0600 files and independent cleanup. Two initial attempts failed on original Auth ownership/default privileges; they remain failures in private logs. The successful application-only attempt remaps ownership and excludes nine DEFAULT ACL entries, retaining existing object ACLs and RLS. It does not recover the Supabase platform or future-object default-privilege bootstrap. Global roles and the source database were not changed to force a pass.

Tests-first evidence: withdrawal lock regression failed with `55P03`; outbox's two-household race reproduced `40P01`; acknowledgment races reproduced `40P01`/`55P03` and stale-membership acceptance. URL admission originally failed seven of eight new cases. Authorization probes reproduced six denial failures; a separate repeated-pause probe returned the wrong-target receipt until the handover ID check was added. Focused fixed results and final integrated results are recorded below; application failure injection verifies transactional rollback, not a real database outage.

## Executed checks

Final serial integration completed on task-local Node 22.23.3/npm 10.9.9. Raw logs are private under `.local/p9-operations-2026-10-21/`; [redacted operations evidence](../evidence/phase9/operations-2026-10-21.json) records actual results and current source hashes.

| Executed check | Actual result |
|---|---|
| Final full local suite | **227/227 PASS**, zero skips/failures; 171791.933667 ms |
| Production typed-browser | **60/60 PASS**, no retries; **12.0 minutes** |
| Isolated synthetic/mocked voice | **5/5 PASS**, no real provider endpoint/credential |
| Existing seven HTTP proofs + new P9 security proof | **Eight commands PASS**, including nine security checks |
| Fictional pairing HTTP/MCP trace | **Seven shapes PASS** |
| Typecheck / production build / schema lint | **PASS** |
| Local setup / lockfile audit / installed dependency graph | **6/6 PASS** / **zero known vulnerabilities** / **valid** |
| Selected source/browser credential scan | **PASS**, read-only; 355 inputs / 15 browser assets; limits in evidence |
| Updated-document local Markdown targets | **158/158 resolve** across 14 documents |

The earlier 218/218 and 226/226 runs passed before the additional acknowledgment cases/target guard and remain intermediate logs, not final source identities.

- Dedicated withdrawal proof: **PASS**, nine affected households / three exact-species protocol clones, six active/interrupted sessions plus three plans without sessions, two unrelated controls, nine canceled progression prompts and zero additional replay mutations. Worker measured **219.21 ms** for this bounded fixture; not production-scale timing or human operator acceptance. Bundled protocols were not revoked. [Evidence](../evidence/phase9/withdrawal-operations.json).
- Application-schema restore: **PASS_APPLICATION_SCHEMAS_ONLY**; **75** table names/counts and RLS flags matched, **64** RLS-enabled tables / **32** identical policies, **eight** restored owner/caregiver/foreign-scope/expired-session/anonymous/provenance checks. Scratch database and private archive removed before PASS. Ownership and nine omitted default-privilege entries remain explicit limitations. [Evidence](../evidence/phase9/application-restore-2026-10-21.json).
- Focused outbox regression: **4/4 PASS**. Initial focused acknowledgment plus existing planning suite: **25/25 PASS**; expanded authorization plus planning: **33/33 PASS**. Exact-target receipt proof: **0/1 before → 1/1 after**. These precede the final broad run and do not substitute for it.
- Pure unit suite: **11/11 PASS**, no database access allowed by the loader.

To repeat only the application drill, select the tested Node runtime, set `DENLUMI_PG_BIN` to the matching PostgreSQL 17 client directory and run `npm run test:p9:restore` with the isolated local configuration. In this preserved native workspace use `.local/run-native.mjs` as documented in the earlier handoff. The drill reads the current database, creates fictional canaries and temporarily copies its application/Auth records privately; no dump belongs in public artifacts. It refuses nonlocal targets, missing tool selection, mismatched client major versions or insufficient capacity.

The first production browser run was **59/60**, with sample creation HTTP 200 at **5,080 ms**, beyond a five-second heading assertion. The test now separately waits for bounded real provisioning success before the unchanged UI assertion. No application timeout, permission or rate limit was weakened. Raw failure trace is retained privately. Fresh Phase 0 capture defaults are now ignored/private; two newly written renders were preserved privately and known historical source images restored from the retained snapshot. The index also corrects an old provider-success description: September 22 Phase 0 output actually had expired credentials for all three clients; current HTTP proof is provider-disabled. Later real Phase 6 calls remain separately dated.

No restore over/drop of the source database, old unconsented-fixture purge, hosted Supabase operation, real inference/speech request or publication occurred. Deletion proofs removed only their exact task-created fictional fixtures.

## Remaining acceptance gates

| Gate | Concrete next action / boundary |
|---|---|
| Human supported-device/keyboard/screen reader/native zoom/non-audio usability | Use [the prepared H01–H08 packet](P9_HUMAN_ACCEPTANCE.md), record real observations and retests. All initial results remain NOT_RUN. AI/browser emulation cannot sign it off. |
| Practical animal content | Real qualified reviewer approves each exact digest/version/locale/scope; all current fixtures remain `demo_only`. |
| Retention and consented cleanup | Decide [the table-specific worksheet](PHASE_9_METADATA_RETENTION_PROPOSAL.md), then encode/test reviewed selectors and separately consented operations. No blanket 30-day purge or retroactive fixture cleanup. |
| Full recovery and operations | Separate platform roles/service ownership/default privileges, Auth HTTP replay, backup custody/expiry/disposal, clean-machine Docker replay, older-record recovery and production-scale/real-operator withdrawal. Current application copy and bounded worker proof close only their narrower scopes. |
| Bedrock and live speech | Read-only identity refresh at 2026-10-20 21:12:45 UTC was BLOCKED_EXPIRED_AWS_SESSION; authorization is unknown. Owner login precedes separately authorized availability/inference work. No enablement, IAM/billing change or provider success inferred. |
| Runtime security | Official release index refresh at 2026-10-20 21:55:53 UTC still showed Node 22.23.3 as latest 22.x. Announced October 21 patch not available at that check; recheck before release. Zero npm audit findings do not audit runtime/bundled code completely. |
| P10 delivery | Follow [ordered next steps](submission/NEXT_STEPS.md): owner film watch/listen, exact sanitized source reconciliation/parity, owner fields/rights, then separately authorized publication/upload/form submission. No accepted video URL or submission receipt exists. |

The official deadline was independently refreshed in the P10 packet: **October 23, 2026, 12:00 PDT / 19:00 UTC / 22:00 Cairo**. Keep the material freeze/free judging access instructions in that packet; no reminder or automation was created.

## Files and continuation

Product sources: `packages/domain/{local-database,db,sessions,routines,planning}.ts`. Regression/tooling: `tests/e2e/phase0.spec.ts` (real provisioning-response wait and private captures), `tests/{local-database.test,p9-withdrawal-operations.test,p9-outbox-order.test,p9-handover-lock.test,withdrawal-fixture}.ts`, `tests/unit-environment.mjs`, `scripts/prove-phase9-{withdrawal,application-restore}.ts`, `package.json`. No dependency versions or migration changed this turn.

Preparation/status: `docs/JUDGE_SETUP.md` and `evidence/phase0/README.md` correct historical capture/provider labels; this handoff; `docs/P9_HUMAN_ACCEPTANCE.md`; retention worksheet; submission `NEXT_STEPS.md`, `READINESS.md`, `PRODUCT_FEEDBACK.md`; `devpost-submission.md`; roadmap/tasks/decisions/P10 handoff; redacted phase evidence and latest provider identity status. No practical-content approval, retention policy approval or owner declaration was manufactured.

Coordinator is this chat. CWD `<local-workspace>`, branch `main`, unborn HEAD, original checkout untracked; preserve all ignored/private inputs and unrelated work. Native Supabase host PID 33598 pre-existed this task and must be preserved. Task-owned production/voice/browser processes stopped; app port 3400 is free and pre-existing native host PID 33598 remains. The retained 281-file public checkout, publication manifest and exact Grady film were verified unchanged. Private restore databases/directories are absent. Current source hashes were checked; earlier snapshot hashes are left historical. No ownership transfer was created.

Smallest next independent software action: recheck Node's announced release and prepare a reviewed local source diff; do not infer publication from preparation. Smallest owner action: watch/listen to the exact local Grady film and record acceptance or timestamped corrections, while upload stays paused. P9 human/policy/provider/platform gates remain open even if the fictional hackathon simulation is submitted.
