# Denlumi project roadmap

Planning baseline: 2026-09-16; status updated 2026-10-21. A01–A08 correctness and P8 W01–W04 software workflows are locally verified. Current P9 local operations/security checks passed 227/227 suite, 60/60 typed-browser, 5/5 mocked voice, HTTP/schema/build and bounded withdrawal/application-restore checks. See [P9 operations](P9_OPERATIONS_HANDOFF.md) and [earlier hardening](P9_HARDENING_HANDOFF.md). Human, exact-version content, policy, provider and full-platform/clean-machine acceptance remain open; this is not full R0/customer release. P10 delivery remains incomplete with [ordered next steps](submission/NEXT_STEPS.md), and upload stays paused. R1/R2 remain conditional. Supabase remains local-only.

## Source and phase convention

Canonical phase numbers come from [build-pack doc 10](../Denlumi_Build_Pack_v1/docs/10_delivery_hackathon.md). [START_HERE_CODEX.md](../Denlumi_Build_Pack_v1/START_HERE_CODEX.md) defines the Phase 0 boundary. The two supplied attachments and [MASTER_BLUEPRINT.md](../Denlumi_Build_Pack_v1/MASTER_BLUEPRINT.md) provide the complete product intent. Differences are resolved in [SPEC_RECONCILIATION.md](SPEC_RECONCILIATION.md).

Release labels are separate from implementation phases:

| Release | Intended outcome | Gate |
|---|---|---|
| R0 | Real backend and disclosed Alexa-style browser demonstration; all three pairings, single-pet care, multi-pet coordination, handover and support routing | Software evidence and honest demonstration disclosure; all bundled protocols stay `demo_only` |
| R1 | Limited customer pilot with only applicable approved modules | Exact-version professional review, privacy/terms and participant arrangements, operational and accessibility checks |
| R2 | Additional reviewed scenarios/locales; optional native clients and Alexa integration | Separate authorization, validated need, applicable content/platform access and review |

`P0` in the pack's 75 acceptance-test definitions means **priority**, as specified by `priority` in [acceptance-tests.json](../Denlumi_Build_Pack_v1/qa/acceptance-tests.json). It does not assign every test or feature to implementation Phase 0.

## Product contract throughout the roadmap

- Settle, Share and Review operate on one current household plan. Database records are authoritative; chat history is not state.
- Cat-cat, dog-dog and cat-dog use distinct applicable protocols and prerequisites. Mixed cases preserve which species is the newcomer. Single-pet cases need no dummy pair; multi-pet records preserve separate pair contexts without implying group readiness.
- R0 supports English, a logical multi-pet model, a pilot usability limit of six active pets and four adult caregivers, and one unresolved guided introduction session per household. Ordinary routine recording is independent.
- Every consequential request rechecks authenticated actor, household/pet/case scope, version, safety epoch and protocol state. RLS complements server authorization.
- Local stop cancels software guidance and current/queued audio without a network or model. A device stop and a committed household pause are distinct observable states. Neither implies physical animal control or supervision.
- Preserve report text, actor/target direction, negation, uncertainty, observation/report times and provenance. A model-written confirmation is insufficient; exact draft confirmation is an authenticated human action.
- No model can advance a plan, clear holds, invite users, authorize external sharing, change medication or actuate devices. No automatic external messages, booking or emergency calls.
- Practical content requires attributable qualified review of its exact version, scope and locale. A demo review state tests software behavior only. Unsupported, unreviewed, expired or revoked guidance fails closed while appropriate coordination remains available.
- Keep secrets, private household content, unlicensed screenshots and font files out of public artifacts. No fabricated provider results, reviewer identities, endorsements or customer outcomes.

## Canonical implementation phases

### Current execution order after the October 20 audit

These are completion slices inside the existing phases, not new phase numbers:

1. **P8/P9 correctness — locally verified:** A01–A08 passed tests-first regression and final integrated checks (166 domain, 37 typed-browser): persisted Stop; immutable routine history/scope; scenario eligibility; exact retry replay; household expiry; inbox/worker eligibility; current protocol checks; consistent displayed availability. Track actual results in [R0_CORRECTNESS_HANDOFF.md](R0_CORRECTNESS_HANDOFF.md).
2. **P8 workflow completion — locally verified:** W01 normal household/pet/situation setup and empty states; W02 session finish/resume/correction; W03 routine rules/claims/attributed reports/corrections; W04 scoped caregiver and home resource/responsibility management. Keep practical guidance unavailable without reviewed content. See [the P8 workflow handoff](P8_WORKFLOWS_HANDOFF.md) for actual checks and limits.
3. **P9 hardening and acceptance:** current [local operations/security](P9_OPERATIONS_HANDOFF.md) and earlier dependency fixes are verified; recheck the announced Node security patch before release. Use the prepared human task packet and table-specific retention worksheet for real decisions/observations. Bounded withdrawal and limited application restore do not close production-scale/platform recovery, backup expiry or clean-machine gates. Providers remain deferred after expired AWS identity.
4. **P6 provider / P10 delivery gates:** renew owner AWS login and recheck Bedrock before claiming inference; reconcile the tested source snapshot and judge instructions; obtain owner film review and explicit upload resumption, verify the real public video, then complete owner form declarations/submission. Existing authorization does not lift the upload pause or permit hosted Supabase.
5. **R1/R2 only after their gates and separate scope:** genuine reviewed practical-content product/pilot; eligible commerce; additional reviewed scenarios/locales and optional native integrations. No R0 test count closes these gates.

All phase transitions require a recorded handoff with changed files, actual commands/results, evidence limits, decisions, blockers and the smallest next task. A failed required provider probe is `BLOCKED` or `FAIL`, never a synthetic success. Local tests, real HTTP transport, live providers, hosted behavior and professional review are separate evidence categories.

| Phase | Scope and dependency | Intended gate and evidence |
|---|---|---|
| **0 — Feasibility; local evidence recorded** | Small reproducible monorepo foundation; pinned current verified dependencies and immutable lockfile; typed fictional simulation; real authentication and household-scoped read; minimal load/pause/fresh-read state probe; real HTTP MCP and Bedrock feasibility; speech capability result; cost guard; migration/RLS and demo/live isolation plan. | Redacted real auth/database evidence; MCP `initialize`, `tools/list`, `tools/call` traces using the selected required version; actual Bedrock request outcome including region/model and guard; real speech feasibility result with typed fallback. Fictional state survives a fresh session, local stop works offline, and the bounded pause/freshness probe refuses stale access/action. Show exact limitations if credentials or capability are unavailable. **Stop with Phase 0 report; do not automatically start Phase 1.** |
| **1 — Household state** | After authorized continuation from P0: executable relational migrations, indexes and constraints; identity, membership/roles, household, pets, canonical pairs and case participants. Preserve same-household composite references; support one-pet and multiple-pet records. | Cross-tenant reads/writes denied; expired/revoked grants denied; caregiver/reviewer/support scopes enforced; invalid references and duplicate canonical pairs rejected. Relevant AT038–041/045 plus schema tests. Logical ERD is not migration evidence. |
| **2 — Routing and content registry** | P1; structured case intake, support levels, all scenario definitions, protocol lifecycle/version/digest registry, and immutable demo/live separation. | SC01–SC17 route to their specified support/release boundaries (AT001–017). Live mode rejects `demo_only`, unreviewed, expired/revoked and inapplicable content (AT018–021). Unknowns remain unknown; professional/urgent restrictions cannot be owner-overridden. No practical guidance is authored by implementing the registry. |
| **3 — Plan and handover** | P2; home zones/resources and list alternatives, participant/home/protocol/epoch-bound plan revisions, owner review and exact-version handover acknowledgment. | Relevant home/participant changes stale dependent reviews; reviewed revisions cannot change in place; old acknowledgments grant no new start permission. Acknowledgment proves reading only. Complete FR-05–07/11 before a broad screen inventory. |
| **4 — Session and observation** | P3; preflight, human start, draft/confirm/correct observation, transactionally consistent pause, finish/interruption and fresh resume checks. | Local offline audio cancel and honest sync status; attributed/negated/uncertain reports; one unresolved session; stale/replayed starts denied; same-key retries deduplicate and changed-body retries reject; disconnect does not silently release progression. Relevant AT022–037/046–053; demonstrate atomic hold/epoch/session/task/handover/outbox changes. |
| **5 — Routine coordination and jobs** | P1 and P4; owner-entered routines, timezone-aware occurrences, attributed/conflicting task reports; transactional outbox, worker retries and internal inbox; authorized configured delivery only. | No double completion or lost conflicting report; deterministic recurrence across DST; at-least-once jobs yield idempotent effects; stale queued prompts canceled at delivery; provider acceptance, delivery and acknowledgment remain separate. AT054–061. SQS/Lambda/EventBridge are integrated only to the extent actually needed and authorized. |
| **6 — Conversation and voice** | P4, P5 as needed, and P0 provider feasibility; bounded Bedrock orchestrator discovers allowed MCP tools and executes actual authenticated HTTP calls; push-to-talk, clarification, captions/text equivalence and interruptible output. | Fresh conversation retrieves changed database state without old chat history; ambiguous names, pronouns and negation handled; forged/forbidden tools rejected; microphone denial/model/speech outage leave usable typed/manual controls. AT062–067 and agent evaluations. Report actual voice provider outcome; no native Alexa claim. |
| **7 — Private summary, export and scoped sharing** | P4 with required record sources from P5/P6; attributed factual summary and owner preview; private text/HTML export; exact-content authorization; scoped expiring/revocable grants; data export/archive/deletion controls. | No diagnosis or silent send; actor/content/destination/scope/expiry changes invalidate authorization; unauthorized/expired/revoked access denied; object keys alone grant no access; deletion disables access and verifies primary cleanup while disclosing backup limits. AT042–044 plus export/retention tests. PDF and professional portals stay optional future work. |
| **8 — Coverage, usability and content review** | P2–7; complete the identical software flow with distinct cat-cat, dog-dog, and both cat-dog newcomer contexts; single-pet and multi-pet paths; sample picker and coherent Today/Pets/Home/History views; qualified content review process. | Three distinct pairing traces, single-pet flow without a fabricated participant and multi-pet dependency invalidation; fictional observed usability tasks. Record real scoped reviewer identity/digest only when supplied and verified. R0 software completion does not imply R1 content approval. |
| **9 — Accessibility and operational hardening** | Integrated P1–8; keyboard/screen-reader, 320 CSS-pixel viewport, 200% zoom, reduced motion and non-audio routes; permission/security regressions; outage/recovery, cost controls, privacy/retention, restore and content-revocation operations. | AT068–072 plus relevant full regression and provider-failure evidence; actual measured latency against PRD targets; fictional-data backup restore; no browser service key/private telemetry; kill switch and stale notification cancellation exercised. Failed or unrun checks remain explicit. |
| **10 — Public evidence and submission preparation** | P8–9; truthful marketing website, sample demo, source/license/run instructions, redacted evidence, feedback/friction log and English demo video target 2:40. | Public-artifact secret/privacy/license check; reproduce setup and demo; verify any public links after explicitly authorized publication; current official rules checked before submission. Explain real backend vs simulated surface, unreviewed content and unavailable integrations. No fabricated feedback, badges or success claims. Publication, domain purchase, legal attestations and competition submission require their own authority. |

The first full product slice after Phase 0 spans P1–4, the required part of P6, and a private preview from P7: fictional cat-dog household → reviewed-in-demo plan → session → confirmed observation → committed pause → stale second-caregiver refusal → new-conversation retrieval → private summary preview. Then run the same software contract against distinct cat-cat and dog-dog fixtures. Shared infrastructure can be reused; practical content cannot be relabeled across species.

## Coverage and release mapping

The authoritative scenario names and routes remain in [doc 03](../Denlumi_Build_Pack_v1/docs/03_scenario_matrix_and_safety.md) and [scenario fixtures](../Denlumi_Build_Pack_v1/fixtures/scenarios.json).

| Scenarios | Required coverage | Implementation and release boundary |
|---|---|---|
| SC01–02 | First cat or first dog; individual records/routines with no pair requirement | P1/2/5/8; fictional R0 module, exact reviewed R1 guidance |
| SC03–04 | Cat-cat and dog-dog, with distinct prerequisites/content | P2–4/6/8; both included in R0 demonstration |
| SC05–06 | Cat-dog with newcomer cat and newcomer dog kept distinct | P2–4/6/8; initial slice plus distinct newcomer coverage |
| SC07 | Three or more pets, separate pair contexts and household coordination | P1–5/8; R0 coordination; pair results never authorize a group session |
| SC08–10 | Age/context modifier, return/reintroduction, changed home context | P2/3/8; clarification/coordination in R0 as fixture specifies; applicable reviewed R1 modules required for guidance |
| SC11–12 | Temporary sitter/new caregiver and everyday shared care | P1/3/5/7/8; scoped expiring access, exact handover and conflict-aware reports |
| SC13–16 | Conflict concern, distress/noise concern, changed human household, injury/illness concern | P2/4/7/8; support routing, pause, records and private summaries; no automated treatment or child-led sessions |
| SC17 | Sensitive archive when a pet leaves or dies | R0 schema/history/export foundations remain intact; dedicated coordination workflow is R1 per scenario matrix |

FR traceability: FR-01/02/06 → P1; FR-03/04/16 → P2/8; FR-05/07/11 → P3; FR-08/09/10 → P4; FR-12/14 → P5; FR-15 → P0 feasibility/P6; FR-13/17 → P7 and the SC17 R1 extension; FR-18 → no R0 checkout and conditional R1 work. UX and failure states apply to the relevant slice from its first implementation; P8/9 complete cross-product coverage.

## Conditional full-product work after R0

These lanes preserve the full product vision without granting implementation authority or inventing new numbered phases.

| Lane | Intended outcome | Dependency and stop gate |
|---|---|---|
| R1 reviewed pilot | Reviewed practical modules for applicable single-pet, cat-cat, dog-dog and mixed contexts; limited household pilot | Identifiable qualified reviewer approves each exact digest/locale/scope; terms/privacy and participant arrangements; operating/restore/accessibility evidence. Unapproved modules remain coordination-only. |
| R1 customer validation | Twelve households, four per pairing, with single-pet/sitter crossover where feasible; start with fictional usability | Observe task completion, interpretation of reported/reviewed/paused/unverified states and actual handover use. Pack thresholds are hypotheses, not findings. No manufactured stressful encounters. |
| R1 commerce | Test the proposed $29/90-day nonrenewing household pass and cost limits only after validated need | Actual business/provider eligibility, settlement/tax/cancellation/privacy terms and explicit commercial authority; signed deduplicated server webhooks. Help, pause, relevant records and export remain available after expiry/quota. No real checkout in R0. |
| R1 expanded coordination | SC17 sensitive archive and routine revision; larger-household workflow if warranted | Preserve historical records; separately reviewed group workflow for use beyond pilot limits; no automatic replacement-pet advice. |
| R2 content and language | Additional approved scenario modules and reviewed Arabic/RTL localization | Separately reviewed translations, locale/version gates and actual accessibility/name-pronunciation checks; never runtime translation of practical guidance. |
| R2 optional interfaces | Native clients, actual Alexa add-on, professional case portal or PDF | Demonstrated need and explicit authorization; native access/account-linking/platform review and real device verification where applicable. Browser simulation proves none of those gates. |

Excluded unless product scope is explicitly revised: veterinary diagnosis/treatment, medication/diet engines, aggression-treatment automation, compatibility/emotion scoring, surveillance, pet-door/device control, social feeds/marketplaces and forced-progress gamification.

## Evidence, dependencies and stop condition

Unresolved gates must have an owner and concrete next action in the phase handoff: provider credentials/access and approved spending; exact tested dependency/model/protocol/speech versions; qualified reviewers; brand/domain clearance; privacy/terms; public publication/submission authority; pilot participants; optional native platform access. Availability must be established by the relevant successful authorized operation, not an installed SDK or a source citation.

The pack's schedule and October 23, 2026 noon-Pacific deadline are planning inputs from the supplied specification, not a fresh rule verification. Recheck official rules and timezone conversion before any publication/submission decision; the plan's intended demo freeze is at least five days before that confirmed deadline.

**Current status: P8 software and P9 scoped local checks are verified; human/policy/provider/platform gates and P10 delivery remain open. See [P9 operations](P9_OPERATIONS_HANDOFF.md) and [P10 packet](submission/NEXT_STEPS.md). Supabase stays local-only and upload remains paused. Bedrock authorization is unknown after the October 21 Cairo expired AWS identity refresh; historical provider results retain their original limits.**
