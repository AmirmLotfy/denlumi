# 10 - Build plan and hackathon delivery

## Build strategy
Deliver one verified vertical slice before expanding screens. All three pairings share infrastructure but not the same practical protocol. The data model supports broad cases; the release scope does not mean writing twenty unreviewed training programs.

## Phases and gates
| Phase | Work | Evidence required |
|---|---|---|
| 0 | Repository, provider feasibility, typed simulation | Real auth, MCP and Bedrock test; speech capability result; cost guard |
| 1 | Database, roles, household/pets/pairs | Cross-tenant and permission tests; composite references |
| 2 | Case routing, protocol registry, demo isolation | All scenario fixtures route correctly; demo content blocked in customer mode |
| 3 | Current plan, home zones, review, handover | Version checks and acknowledgments work |
| 4 | Session preflight, observe, pause, finish | Local stop; stale-state and single-session tests |
| 5 | Routine coordination, reports, jobs | No double completion; stale notification suppression |
| 6 | Actual MCP conversation and voice | Fresh-session retrieval; ambiguous name/negation tests |
| 7 | Owner-approved summary/export/share | Scope/expiry/revocation tests; no automatic send |
| 8 | All-pairing UX and expert review | Three distinct pairing demos; no invented reviewer approval |
| 9 | Accessibility, reliability, hardening | Documented tests and provider-failure cases |
| 10 | Website, demo video, repository, feedback | Public links verified manually; secrets scan; run instructions |

Human credential, domain, account, consent, and content-review decisions cannot be fabricated by Codex. Report blockers with a useful alternative that preserves the rule, not a hidden bypass.

## Timeline
From 2026-09-16, use the first week for feasibility/core state, the second for plan/session behavior, the third for MCP/voice/routines, the fourth for pairing coverage and observed usability, and the final period for expert review, hardening and submission. Aim to freeze the demo at least five days before the deadline.

The current rules list October 23, 2026, 12:00 pm Pacific as the submission deadline [S1]. Build in the timezone conversion explicitly; do not assume the local date changes at midnight.

## Track
Primary: Alexa+. Use the explicitly permitted simulated experience path [S1]. A real MCP implementation supports the demonstration and later portability. Optional AWS Builder mini-challenge only if the AWS integrations are real and useful. No Bee hardware or Ring dependency. Do not add Fire TV simply to name more tracks.

## Demo script: target 2 minutes 40 seconds
0:00-0:15 - Problem: two caregivers have different information about the same pets.
0:15-0:30 - Show a three-pet fictional household: one dog and two cats. State that the Alexa-style browser surface is simulated.
0:30-0:55 - Start the eligible fictional session through actual preflight and real HTTP MCP calls. Show a brief tool trace, not a long developer console.
0:55-1:25 - Record an ambiguous report. Ask the needed attribution question. Confirm a concern. The backend pauses the relevant guidance and invalidates the old handover.
1:25-1:50 - In a second caregiver window, try the old plan. The app refuses stale guidance and shows the current change. Do not claim a delayed push has arrived before it has.
1:50-2:15 - Ask in a new conversation why the plan is paused. Retrieve stored state and prepare a factual professional summary; nothing is sent without approval.
2:15-2:30 - Briefly show cat-cat and dog-dog routing with their separate prerequisites; single-pet care does not require a fake pair.
2:30-2:40 - State what is real, what is simulated, and what requires professional/native-platform review.

Use fictional fixtures and original/authorized visual assets. Never stage pet stress, fake an expert endorsement, or claim the demonstration proves behavior improvement.

## Submission checklist
Public licensed repository including simulation source and setup instructions; under-three-minute English public demo; product description; actual product feedback/friction logs; no credentials or private household data [S1]. Keep logs of reproducible API/SDK friction, not invented praise. Submission, video upload, and account terms may require Amir's direct actions.

## Recommended evidence bundle
Architecture diagram; three pairing test traces; stale-session refusal; revoked-user denial; local offline-stop result; unsupported/professional case behavior; actual MCP request; model outage fallback; simple unit-cost trace; list of unimplemented/conditional integrations. Document simulation explicitly on the site, in the video, and README.
