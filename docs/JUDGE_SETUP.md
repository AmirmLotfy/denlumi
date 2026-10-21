# Run the fictional Denlumi demo

This is the Alexa+ **simulated experience** entry. The typed path requires no native Amazon device, platform certification, real animal, hosted backend or paid provider call. All sample protocols are demo_only and have no qualified practical approval.

## Prerequisites and runtime choice

Use Git, Python 3, **Node 22.23.4** (`.nvmrc` / `.node-version`), **npm 10.9.9** and **Supabase CLI 2.121.0**. Install the CLI using the [official installation guidance](https://supabase.com/docs/guides/local-development/cli/getting-started) and the matching platform artifact from the [official 2.121.0 release](https://github.com/supabase/cli/releases/tag/v2.121.0). Verify the release checksum as directed by the publisher and put that version on your PATH. Run `supabase --version` and confirm **2.121.0** before continuing. This guide does not claim that a particular npm-wrapper installation was tested.

The [official runtime guide](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes) describes native services for supported macOS Apple Silicon and Linux hosts, and a Docker route. The native path below was exercised on macOS Apple Silicon; Linux execution is not claimed. Docker requires its own running local Docker-compatible engine. Allow adequate disk space for downloaded services/images and the database.

Clone into a new directory and run `npm ci` with the pinned Node/npm versions. Use this clone's own runtime home and generated credentials. Ports **3400** (app), **55431** (API), **55432** (database) and **55430** (shadow database, when used) must be available. If another project owns a required port, stop this setup and choose an isolated environment; do not reuse its database/keys or stop unrelated work. Application guards deliberately require the fixed loopback API/database ports.

## Native setup — supported Apple Silicon / Linux hosts

Run from the new clone's repository root, using the same shell/environment for every native CLI invocation:

```bash
umask 077
mkdir -p .local
export SUPABASE_HOME="$PWD/.local/native-home"
export SUPABASE_EXPERIMENTAL_STACK=1
mkdir -p "$SUPABASE_HOME"
supabase stack start --runtime native --preparation on-demand --exclude realtime,storage,functions,studio,mail,analytics,pooler --eager --output-format json > .local/native-start.json 2> .local/native-start.log
```

Wait for successful startup before continuing. The CLI downloads native service archives and applies the repository migrations automatically. Startup output may contain credentials: the redirected files and runtime home are private, ignored, and must not be pasted into a recording, issue or public artifact. This source currently has fifteen migrations; do not run a second stack or reset another database to make startup pass.

```bash
python3 scripts/configure-local.py
npm run db:setup
npm run dev
```

The public credential helper selects `supabase stack status --output-format json` when `SUPABASE_EXPERIMENTAL_STACK=1`, accepts the native nested `env` result, validates loopback endpoints and creates this clone's own mode-0600 `.env.local`. It withholds CLI output on failure and refuses an existing file. No original workspace credentials, private adapter or `.local/run-native.mjs` wrapper is needed. If a file already exists, preserve it and resolve its origin deliberately rather than overwriting it.

`db:setup` seeds seven fictional demo_only protocols without approvals. Open **http://127.0.0.1:3400**. Bedrock and speech remain disabled by the generated local configuration. Use fictional records only. Additional native details and dated evidence limits are in [runtime notes](LOCAL_NATIVE_RUNTIME.md).

When finished, stop the app you started with Ctrl-C. From this same clone, with the same `SUPABASE_HOME` and experimental flag, stop only its stack:

```bash
supabase stack stop > .local/native-stop.log 2>&1
```

This preserves the stack data for a later start. Do not use destroy/all-stack operations, delete runtime data or change a global Docker context. A new terminal must restore the same two environment variables and working directory before operating this stack.

## Docker alternative

Use this route instead of native, in a separate fresh environment with its own available ports/data. Keep `SUPABASE_EXPERIMENTAL_STACK` unset in that shell; do not mix status commands or runtime homes from the two routes. Select the intended local Docker context and confirm `docker info` succeeds; set `DOCKER_HOST` only if your own runtime needs it.

```bash
supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
supabase migration up --local
python3 scripts/configure-local.py
npm run db:setup
npm run dev
```

The helper uses legacy `supabase status -o json` for this route. No Supabase link, remote migration, cloud project or email invitation belongs in either setup.

**Docker evidence remains unaccepted.** The October 22 isolated Colima attempt failed during VM storage initialization with vdb I/O and journal-abort errors under storage pressure; only the task-owned VM was cleaned up. No successful fresh Docker startup, migration or application replay is claimed. The earlier Docker instructions were originally exercised with CLI 2.90.0; pinning 2.121.0 here is not proof of a completed Docker replay. Prefer the tested native-host route where supported, and check [delivery status](submission/DELIVERY_STATUS.md) for actual subsequent outcomes.

## Exact demonstration

1. Choose the fictional cat–dog household and explicitly acknowledge its retention notice. This creates an isolated sample; access lasts 24 hours. Save the one-time deletion code privately if you need deletion after losing the session; do not put it in a video or public issue.
2. Follow the on-screen journey: submit fictional intake, create the draft, review the exact fictional revision, record owner acknowledgment, then switch to the authenticated sample caregiver to acknowledge the same handover. This is owner review in a demo, not professional approval.
3. Complete fresh preflight and explicitly start the software session. Use the manual observation form. Keep actor/target and uncertainty visible and confirm the exact draft only when intended.
4. Show the committed software pause and Sam's refusal when using an old saved view. Start a new conversation and retrieve the updated record through actual HTTP MCP.
5. Prepare a private factual preview. Nothing is sent. Use the visible Stop to halt software locally even with the browser's network disabled; server synchronization is a separate outcome.
6. Repeat the distinct cat–cat and dog–dog fixtures as needed. Single-pet fixtures have no second pet; the three-pet fixture provides coordination and no group session.

Use the exact current selectors and labels in `tests/e2e/phase8-journey.spec.ts` if automating. The required sub-three-minute public demo must record actual operation, not a static website or fabricated tool animation.

## Checks and evidence limits

Automated browser checks additionally require installed **Google Chrome** because `playwright.config.ts` selects `channel: chrome`; `npm ci` does not install it. Use the [official Chrome distribution](https://www.google.com/chrome/) if needed. The October 22 host has Chrome **155.0.8059.85**; that existing installation is not fresh-browser-install evidence. Ordinary typed use can run in an available supported browser without running Playwright.

After the local stack is healthy, run checks serially. `npm run typecheck`, `npm run build` and `npm run test:unit` are not database/provider acceptance. `python3 tests/configure-local.test.py` uses a fake CLI; the current eleven checks include native status-command selection and withheld CLI failure output. `node --test tests/public-release.test.mjs` checks export boundaries without database/provider access. For real database/Auth checks use `npm test`; start the app separately before HTTP/typed-browser commands in README.

The mocked-voice harness owns its own server: build first, stop your own app so port 3400 is free, then run `npm run test:browser:voice`. It uses synthetic input and mocked speech; do not start a separate speech server or enable real providers for it.

October 22 fresh-clone verification used a new clone, `npm ci`, a new private runtime home and cold native service downloads on the **same darwin-arm64 Mac**. Startup/migrations, generated private configuration and seven demo_only seeds succeeded after the documented helper repair. The fresh environment subsequently passed 227 domain/Auth/database, 60 typed-browser, 5 mocked-voice, 11 unit, 11 setup and7 export checks, production build/typecheck, actual HTTP MCP and9 security HTTP checks. [Fresh-setup report](P10_CLEAN_SETUP_2026-10-22.md) and [delivery status](submission/DELIVERY_STATUS.md) record actual outcomes. This is not an independent fresh machine, Linux, fresh Chrome installation, Docker, old-record recovery, human usability or provider acceptance.

Fresh Phase 0 browser captures default to ignored `.local/browser-captures/phase0`; keep raw traces, one-time deletion codes and credentials private. The buildless `apps/showcase` serves the public film and explanatory page without a live backend; the interactive application stays local-only. To inspect that static page locally, use `python3 -m http.server 3410 --bind 127.0.0.1 --directory apps/showcase`.

## Historical source-folder replay — October 19–21

The October 19 native recovery passed 110/110 database/Auth/domain and 29/29 typed-browser checks against its new fictional database. Later [P9 operations](P9_OPERATIONS_HANDOFF.md), [Node security evidence](../evidence/phase10/node-security-2026-10-21.json) and [P10 reconciliation](P10_SOURCE_RECONCILIATION.md) record separately dated broader checks. The October 21 exported-folder replay used the existing native stack through a private status-only adapter; it was not a fresh-judge setup. The current native instructions above create the clone's own stack and environment and require no such private adapter.
