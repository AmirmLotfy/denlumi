# Run the fictional Denlumi demo

This guide is for the Alexa+ **simulated experience** entry. No native Amazon device, platform certification, real animal, hosted backend or paid provider call is required for the typed path.

## Prerequisites

Use Node 22.23.4 (pinned in `.nvmrc` and `.node-version`), npm 10.9.9, the Supabase CLI and a running Docker-compatible runtime. The Docker guide was originally tested with CLI 2.90.0. An isolated CLI 2.121.0 native Apple Silicon recovery has now run successfully; see [the exact runtime notes](LOCAL_NATIVE_RUNTIME.md) if Docker is unavailable. Allow adequate disk space for the runtime/images and database before starting; do not run against an existing project database. This repository uses an isolated Supabase project ID `denlumi-phase0` and ports 55430–55432. Other applications may continue using their own ports and volumes.

1. Clone the source and run `npm ci`.
2. Confirm `docker info` succeeds for the intended local Docker context. If needed, set `DOCKER_HOST` to your runtime's socket. Do not copy another person's path or credentials.
3. Run `supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`.
4. Run `supabase migration up --local`.
5. Run `python3 scripts/configure-local.py`. This writes a private `.env.local` from local CLI output, never prints credentials and refuses an existing file or hosted endpoints.
6. Run `npm run db:setup`, then `npm run dev`.
7. Open `http://127.0.0.1:3400`. Leave Bedrock and speech disabled. Use only fictional sample records.

No Supabase linking, remote migration, cloud account, email invitation or external transmission is part of these instructions. On October 19, an isolated experimental native runtime applied the same twelve migrations and seeded the seven demo-only protocols. This verifies the local native path; a clean Docker replay remains unverified.

## Exact demonstration

1. Choose the fictional cat–dog household and explicitly acknowledge its retention notice. This creates an isolated sample; access lasts 24 hours. Save the one-time deletion code privately if you need deletion after losing the session; do not put it in a video or public issue.
2. Follow the on-screen journey: submit fictional intake, create the draft, review the exact fictional revision, record owner acknowledgment, then switch to the authenticated sample caregiver to acknowledge the same handover. This is owner review in a demo, not professional approval.
3. Complete fresh preflight and explicitly start the software session. Use the manual observation form. Keep actor/target and uncertainty visible and confirm the exact draft only when intended.
4. Show the committed software pause and Sam's refusal when using an old saved view. Start a new conversation and retrieve the updated record through actual HTTP MCP.
5. Prepare a private factual preview. Nothing is sent. Use the visible Stop to halt software locally even with the browser's network disabled; server synchronization is a separate outcome.
6. Repeat the distinct cat–cat and dog–dog fixtures as needed. Single-pet fixtures have no second pet; the three-pet fixture provides coordination and no group session.

Use the exact current selectors and labels in `tests/e2e/phase8-journey.spec.ts` if automating. The required sub-three-minute public demo must record actual operation, not a static website or fabricated tool animation.

## Checks

`npm run typecheck`, `npm run build`, and `npm run test:unit` do not establish database or provider acceptance. `python3 tests/configure-local.test.py` exercises fake CLI output only.

After the local stack is healthy, run `npm test` serially, then start the app and use the HTTP/browser commands listed in README. The fresh native database/Auth/domain suite passed 110/110 on October 19. Check the [current P9 operations handoff](P9_OPERATIONS_HANDOFF.md) for later suite/browser results and remaining evidence limits; earlier Docker evidence remains historical. Some older proof scripts retain a machine-specific directory in diagnostic documentation; no account credentials are portable.

Fresh Phase 0 browser screenshots now default to ignored `.local/browser-captures/phase0`; use a private `DENLUMI_EVIDENCE_DIR` if selecting another location. Keep raw captures/traces and any fictional one-time deletion codes out of publication. Retained source PNGs are historical.

The public `apps/showcase` site is buildless HTML/CSS and an original historical screenshot. Serve it with `python3 -m http.server 3410 --bind 127.0.0.1 --directory apps/showcase`. It makes no live application or provider calls.

## October 21 source preparation and portability boundary

The current source candidate has an isolated export and replay report in [P10 source reconciliation](P10_SOURCE_RECONCILIATION.md). Historical pass counts above retain their dates. Source-folder replay uses a fresh `npm ci` and exported source against the existing native localhost stack; it does not establish clean-machine Docker setup. No private runtime wrapper or credentials are distributed. The native CLI stores stack identity by workspace path, so an existing native stack is not automatically discovered from a new folder; the coordinator used a private status-only adapter to query the original stack, then the exported credential writer created a new mode-0600 local environment. This is test-harness setup, not a clean-judge setup instruction or a request to start/replace that stack.

`python3 tests/configure-local.test.py` checks nine credential-file boundaries with a fake CLI; `node --test tests/public-release.test.mjs` checks six export boundaries without database/provider access. The voice harness owns its own server: build first, free port 3400, then run `npm run test:browser:voice`; do not start another speech server for it.
