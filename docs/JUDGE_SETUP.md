# Run the fictional Denlumi demo

This guide is for the Alexa+ **simulated experience** entry. No native Amazon device, platform certification, real animal, hosted backend or paid provider call is required for the typed path.

## Prerequisites

Use Node 22.13.1, npm 10.9.2, the Supabase CLI and a running Docker-compatible runtime. Allow adequate disk space for the runtime/images and database before starting; do not run against an existing project database. This repository uses an isolated Supabase project ID `denlumi-phase0` and ports 55430–55432. Other applications may continue using their own ports and volumes.

1. Clone the source and run `npm ci`.
2. Confirm `docker info` succeeds for the intended local Docker context. If needed, set `DOCKER_HOST` to your runtime's socket. Do not copy another person's path or credentials.
3. Run `supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`.
4. Run `supabase migration up --local`.
5. Run `python3 scripts/configure-local.py`. This writes a private `.env.local` from local CLI output, never prints credentials and refuses an existing file or hosted endpoints.
6. Run `npm run db:setup`, then `npm run dev`.
7. Open `http://127.0.0.1:3400`. Leave Bedrock and speech disabled. Use only fictional sample records.

No Supabase linking, remote migration, cloud account, email invitation or external transmission is part of these instructions. The clean-machine sequence is documented but has not been replayed in the October 18 check because the original local runtime is absent and the machine has insufficient free storage.

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

After the local stack is healthy, run `npm test` serially, then start the app and use the HTTP/browser commands listed in README. Full integration replay remains open on October 18; earlier evidence is explicitly historical. Some older proof scripts retain a machine-specific directory in diagnostic documentation; no account credentials are portable.

The public `apps/showcase` site is buildless HTML/CSS and an original historical screenshot. Serve it with `python3 -m http.server 3410 --bind 127.0.0.1 --directory apps/showcase`. It makes no live application or provider calls.
