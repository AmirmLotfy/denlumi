# Phases 2 and 3 — routing, plans and handovers

Completed local verification: 2026-09-22. Workspace: `<local-workspace>`. Git branch `main`, no HEAD/commit; the initial project and all current files remain untracked. The user authorized full Phases 2 and 3 and explicitly prohibited real Supabase migrations or deployment because no dedicated hosted project exists.

## Delivered behavior

- Phase 2 migration adds the canonical SC01–SC17 registry, structured intake, five support levels, immutable protocol/version/digest records, review/source relations and fail-closed lifecycle constraints. All bundled protocol payloads remain `demo_only`; no practical instructions, reviewer identity or approval were created.
- Routing validates exact species composition and the mixed-pair newcomer direction. Intake answers and unknowns round-trip unchanged. Reported professional/urgent states cannot be owner-downgraded.
- Phase 3 migration adds versioned home zones, resources, per-pet access alternatives and caregiver responsibilities; participant/intake/home/protocol/epoch-bound plan revisions; immutable plan steps/reviews; structured handovers and exact digest acknowledgments.
- Home, intake and participant changes monotonically advance the safety epoch, stale plans and reviews, supersede published handovers and cancel pending outbox work. Reviewed plan content cannot change in place.
- Adult membership acceptance is stored separately. An unaccepted caregiver cannot acknowledge a handover or receive ownership. An acknowledgment is scoped to the exact current published digest and never proves physical action.
- Same-origin cookie-authenticated human routes cover intake, context, home planning, plan draft/review, membership acceptance, handover acknowledgment and fresh planning retrieval. These mutations are absent from MCP.
- Existing Streamable HTTP MCP and the Alexa-style browser simulation remain real backend clients. The model still cannot approve/review/advance plans, clear holds, acknowledge for a human, share, invite, change medication or operate a device.

## Principal changed files

- `supabase/migrations/20260922113952_phase2_routing_content_registry.sql`
- `supabase/migrations/20260922113953_phase3_plan_handover.sql`
- `packages/contracts/phase23.ts`, `packages/domain/planning.ts`
- `packages/domain/household.ts`, `packages/domain/state.ts`, `packages/content/fixtures.ts`
- Phase 2/3 routes under `apps/web/app/api/cases`, `households`, `plans`, `handovers` and `memberships`
- `tests/planning.test.ts`, `scripts/prove-phase23-http.ts`, `scripts/prove-mcp-http.ts`
- `README.md`, `DECISIONS.md`, `TASKS.md`, `docs/ROADMAP.md`

## Actual verification

| Command | Actual result | Evidence limit |
|---|---|---|
| `DOCKER_HOST=unix://<local-home>/.colima/default/docker.sock supabase db reset --local` | PASS; all four migrations applied from empty local database | Isolated local containers only; no link, remote project, push or deployment |
| `npm run db:setup` | PASS; seven `demo_only` versions seeded, zero approvals | Fictional fixtures only |
| `npm test` | PASS, 55/55 | Local Auth/Postgres/RLS/domain tests; includes all SC01–SC17, permissions, immutable registry, fake-approval rejection, unknowns, professional/urgent restriction, home/plan/review/ack/invalidation, duplicates and failures |
| `supabase db lint --local` | PASS, no schema errors | Local lint only |
| RLS/grant SQL audit | PASS; no public table without RLS and no non-SELECT `anon`/`authenticated` table grant | Local schema snapshot |
| `npm run typecheck` | PASS | Static TypeScript check |
| `npm run build` | PASS | Local Next.js production build |
| `npm run test:browser` | PASS, 2/2 | Desktop and 320px browser simulation; no physical device or native Alexa |
| `npm run test:phase23:http` | PASS | Real authenticated local HTTP: SC06 route, home v2, reviewed plan, exact ack, fresh retrieval and stale ack rejection |
| `npm run test:mcp:http` | PASS | Real authenticated Streamable HTTP MCP: initialize 200, initialized 202, tools/list 200, two tools/call 200 |
| `npm run providers:probe` | BLOCKED | A real bounded AWS attempt was made, but the default session returned `CredentialsProviderError: Your session has expired. Please reauthenticate.` for Bedrock, Polly and Transcribe |
| `aws sts get-caller-identity --profile default` | BLOCKED | Exit 255 with the same expired-session message |
| `npm run test:http` | BLOCKED | Timed out while the assistant route waited on the unavailable AWS credential path; this is not counted as MCP evidence because the dedicated MCP proof passed separately |

The provider result is recorded in `evidence/phase0/providers.json`; the successful local Phase 2/3 HTTP and MCP traces are in `evidence/phase23/`. No successful Bedrock request is claimed.

## Known blockers and limits

- Bedrock, Polly and Transcribe remain blocked by the expired AWS default session. Reauthenticate and first verify STS before one bounded retry.
- There is no hosted Supabase project and no hosted verification. The prohibition on linking, remote migration and deployment is deliberate and ongoing.
- No protocol has real professional approval. Live households therefore fail closed for guidance and cannot draft from `demo_only` content.
- The browser is an Alexa-style simulation. Native Alexa, account linking, physical device control and device testing are absent.
- Phase 4 session state, human start/finish/interruption, confirmed observation correction and atomic session-task transitions are not implemented. The existing Phase 0 observation/pause proof remains deliberately narrow.
- Broad Home/Today/History management screens belong to Phase 8. Phase 3 is currently exposed as authenticated HTTP/domain behavior and retains the existing visual simulation.

## Next smallest vertical slice

After explicit authorization, implement Phase 4's exact-start gate on the current reviewed plan and current caregiver handover acknowledgment. Add one unresolved session per household, explicit human start, draft/confirm/correct observation, interruption/finish, and a single atomic pause transaction that stales the session and dependent work. Reuse the offline Stop and do not add practical animal guidance, provider-dependent safety, remote Supabase, sharing or device control.
