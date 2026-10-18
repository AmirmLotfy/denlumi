# Phase 4 and 5 handoff

Date: 2026-09-22  
Workspace: `<local-workspace>`  
Scope: local fictional implementation only

## Delivered behavior

Phase 4 adds a database-enforced one-unresolved-session rule, authenticated preflight and explicit human start, checkpoint, manual pause, resume, finish and interruption. Every start/resume rechecks current auth session, accepted membership and scope, household state, current reviewed plan, exact handover acknowledgment, protocol lifecycle/locale/scenario/digest, participants, home version, safety epoch, review and active holds. No timer advances a plan.

Session observations are append-only drafts with exact raw text, actor/target direction, negation or uncertainty, separate observation/report times, source, normalized fields and context snapshot. Human-only confirmation can commit a structured concern in one transaction: confirm observation, advance epoch, pause software session, stale plan/review, cancel dependent plan steps/tasks, retain/create restriction, supersede/publish handover, cancel stale outbox work, queue the current internal update and audit it. An appended correction never silently clears the hold. Manual pause creates no professional hold. Protocol withdrawal and heartbeat timeout have explicit maintenance paths.

Phase 5 adds owner-entered nonmedical routine rules, versioned owner edits, deterministic IANA-timezone daily/weekly occurrence generation, independent task claims/reports/corrections, conflict-aware effective state, internal outbox delivery and an authenticated inbox. An edit preserves historical occurrences and reports while canceling only unreported future work from the replaced version. DST gaps use the first valid minute after the requested wall time; overlaps use the first occurrence. Keys include rule version, local date/time and timezone, so retries do not duplicate occurrences.

The worker rechecks epoch, expiry, internal-inbox preference and current accepted membership immediately before delivery. A repeated worker cannot duplicate a delivery. Unknown delivery outcome enters `uncertain` and is not retried blindly. Failure is visible as failure. There is no email provider, SQS, Lambda, EventBridge or external send in this phase.

MCP now exposes `list_due_tasks`, uses the current session preflight, and records session drafts. It cannot start/resume/finish sessions, confirm/correct observations, clear holds, advance plans, invite, share, send externally, change medication or control devices.

## Important files

- `supabase/migrations/20260922121836_phase4_session_observation.sql`
- `supabase/migrations/20260922121837_phase5_routines_jobs.sql`
- `packages/contracts/phase45.ts`
- `packages/domain/sessions.ts`
- `packages/domain/routines.ts`
- `apps/web/app/api/sessions/**`
- `apps/web/app/api/households/[id]/routine-*`
- `apps/web/app/api/households/[id]/inbox/route.ts`
- `apps/web/app/api/tasks/[id]/**`
- `apps/web/lib/mcp.ts`
- `scripts/run-phase45-workers.ts`
- `scripts/prove-phase45-http.ts`
- `tests/phase45.test.ts`
- `evidence/phase45/http.json`

## Actual verification

- Clean local migration reset: all six migrations applied. The project is unlinked; no hosted migration ran.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 63/63 after a clean local migration reset. The Phase 4/5 subset contributes 8 passing cases.
- `npm run test:phase45`: PASS, 8/8 in the final full-suite run.
- `npm run build`: PASS; all Phase 4/5 API routes compiled.
- `supabase db lint --local --level warning`: PASS, no schema errors.
- `npm run test:phase45:http`: PASS against the final local Supabase Auth/Postgres schema and Next.js HTTP; included a real authenticated Streamable HTTP MCP `list_due_tasks` call. Evidence timestamp: `2026-09-22T13:25:05.192Z`.
- `npm run test:mcp:http`: PASS; initialize, initialized notification, tool list/calls over MCP protocol `2025-11-25`.
- `npm run test:browser`: PASS, 2/2 after the final schema replay (desktop and 320 CSS-pixel existing simulation flows, including offline Stop).
- `npm run workers:phase45`: PASS as a local one-shot run; no session or protocol reconciliation was due, and pending internal fictional events were delivered with explicit counts.

## Evidence boundaries and blockers

- All protocols remain `demo_only`; no practical real-animal content or professional approval was created.
- This is local evidence. No hosted Supabase project exists or was linked, migrated or deployed.
- The Alexa-style surface remains a labeled browser simulation. There is no physical Amazon device, native Alexa integration or certification.
- Internal inbox delivery is real local database state. External email/push/provider delivery is unimplemented and unclaimed.
- The earlier Bedrock/speech probe remained blocked by AWS session/provider state. Phase 4/5 did not fabricate or replace that evidence and did not require a model for safety.
- macOS/Colima disk pressure required excluding unused local Supabase services (Realtime, Storage, Studio, analytics/vector and related services) for this phase. Database, Auth, gateway and REST are healthy. Active unrelated LeadToDeal containers and stopped Jadidah data were preserved.
- The repository has no initial Git commit/HEAD; files remain untracked. This predates Phase 4/5 and prevents a meaningful commit diff, but does not affect local tests.

## Next smallest vertical slice

After explicit Phase 6 authorization, add typed conversation clarification on the fixed MCP whitelist, then optional push-to-talk only if the real speech provider path is available. Prove ambiguous names/pronouns, model outage, microphone denial and fresh-state retrieval while keeping every session mutation human-only and Stop fully local.
