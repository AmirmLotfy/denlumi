# Denlumi

Denlumi is a shared-home companion for cats, dogs, and their adult caregivers. This repository contains **locally implemented Phases 0–7 plus P8 W01–W04 software workflows**; Phase 6 and 7 provider/human acceptance deferrals are recorded in [the closure report](docs/PHASE_6_7_CLOSURE.md). It includes bounded conversation, optional microphone capture, private factual previews/exports, verified-recipient sharing, archive and household deletion. The fictional local demonstration uses authenticated shared state, observation-driven software pause, stale-caregiver refusal, fresh-conversation retrieval through Streamable HTTP MCP, and a network-free local Stop.

All bundled protocols are `demo_only`. They are not professionally approved and cannot be used as practical guidance for real animals. The browser surface is an **Alexa-style simulation**. It has no native Alexa certification, physical Amazon device, persistent listening, supervision, or device control.

## Local setup

Use Git, Python 3, Node **22.23.4** (`.nvmrc` / `.node-version`), npm **10.9.9** and Supabase CLI **2.121.0**. Install/check the pinned CLI through the official links in [judge setup](docs/JUDGE_SETUP.md). The verified fresh-clone route below uses experimental native services on **macOS Apple Silicon**; official Linux support is documented but not exercised here. Judge setup also retains the Docker alternative and its failed verification result.

From a new clone with ports 3400 and 55430–55432 available:

```bash
npm ci
umask 077
mkdir -p .local
export SUPABASE_HOME="$PWD/.local/native-home"
export SUPABASE_EXPERIMENTAL_STACK=1
supabase stack start --runtime native --preparation on-demand --exclude realtime,storage,functions,studio,mail,analytics,pooler --eager --output-format json > .local/native-start.json 2> .local/native-start.log
python3 scripts/configure-local.py
npm run db:setup
npm run dev
```

Wait for successful stack startup before continuing. Native startup applies all fifteen local migrations. The helper creates this clone's own ignored mode-0600 `.env.local`; startup/status output may contain credentials and must remain private. Open `http://127.0.0.1:3400`. Use fictional records only, with Bedrock/speech disabled. No cloud account or paid provider call is needed. Stop your own app, then `supabase stack stop` from the same clone/environment to preserve its data. Do not reuse another project's keys or stop unrelated services. [Complete setup, prerequisites and limits](docs/JUDGE_SETUP.md).

## Household setup and management — October 20

Open `/household` on the running local app. Sign in through `/login` using an existing verified local account; no public signup/email service is configured. Household setup works without a pet, case or plan. Add owner-reported pets and a situation; records with no approved module remain coordination-only. The six-active-pet/four-adult-grant R0 limits are enforced on the server.

The workspace includes pet editing, routine schedules/claims/attributed reports/corrections, home resource/access/responsibility versions, settings and local scoped caregiver access. An intended recipient supplies their local account reference privately; no external invitation is sent. They review the role, scope and expiry and accept the exact `grant_version`. New or changed pending access cannot read household records. Revocation is checked on subsequent requests.

The fictional Today console supports human session checkpoint/pause/resume/finish and append-only corrections, including finished records. Owner review and caregiver operation remain separate. Local Stop blocks continuation, and no action establishes physical animal safety. Final local checks passed 176/176 domain tests, 60/60 typed-browser tests, three HTTP examples, typecheck/build and schema lint. See [the P8 workflow handoff](docs/P8_WORKFLOWS_HANDOFF.md) for changed files, exact results and release limits.

## P9 local hardening — October 21

Dependencies and request/session limits are hardened, with final **227/227 domain**, **60/60 typed-browser**, **5/5 isolated mocked voice**, local HTTP/security/schema checks and a zero-known-vulnerability lockfile audit. See [P9_OPERATIONS_HANDOFF.md](docs/P9_OPERATIONS_HANDOFF.md) for exact versions, failures, verification and remaining gates. The isolated voice command requires a built app and free port 3400, uses fictional credentials and loopback-only AWS endpoints, and mocks successful speech responses. Human voice/provider acceptance is separate. The October 21 security release, [Node 22.23.4](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases), is now the required runtime; earlier P9 results retain their executed Node 22.23.3 provenance. The final Node 22.23.4 rerun passed the same 227 domain/Auth/database, 60 typed-browser and five mocked-voice checks; [release evidence](evidence/phase10/node-security-2026-10-21.json) records exact execution.

## Current hackathon status — 22 October 2026

[Public source](https://github.com/AmirmLotfy/denlumi) · [Public presentation](https://denlumi-showcase.vercel.app) · [Judge setup](docs/JUDGE_SETUP.md)

The Alexa+ entry uses the permitted simulated-browser path. The [official deadline](https://amazonappdev2026.devpost.com/rules) is **23 October 2026, 12:00 p.m. PDT / 19:00 UTC / 10:00 p.m. Cairo**. Phases 8–9 have substantial local implementation and recorded checks, with human/provider/operational acceptance still open. Phase 10 publication and submission preparation are now authorized. The [submission draft](devpost-submission.md), [readiness checklist](docs/submission/READINESS.md) and [current handoff](docs/PHASE_10_HANDOFF.md) distinguish actual evidence from missing deliverables.

Historical October 19 isolated local native Supabase recovery passed **110/110 database/Auth/domain tests**, **29/29 typed browser tests**, six setup-boundary tests and typecheck. See [the runtime notes](docs/LOCAL_NATIVE_RUNTIME.md) for tested CLI/service versions, setup and evidence limits. This is a fresh fictional database; Docker replay and older accumulated-fixture performance remain unverified. No new AWS request or professional approval is claimed.

The public presentation in `apps/showcase` now serves the exact 1:44 Grady submission film, matching captions/transcript, film-frame poster and a YouTube link, alongside a clearly historical original screenshot. It does not expose a live backend or collect household data. The actual interactive application remains local-only. Original source is licensed under [MIT](LICENSE); third-party rights remain in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Verification

Browser checks require **installed Google Chrome**: `playwright.config.ts` selects the `chrome` channel. `npm ci` installs the test runner, not that browser. Install Chrome from [its official distribution](https://www.google.com/chrome/) if it is absent. The recorded October 22 host has Chrome 155.0.8059.85. No browser installation or system browser change is performed by this repository. Run the app before typed-browser/HTTP checks; free port 3400 before the mocked-voice harness.

```bash
python3 tests/configure-local.test.py # eleven private-file/local-boundary tests
node --test tests/public-release.test.mjs # seven export/link/binary/provenance boundaries
npm run audit:dependencies
npm run typecheck
npm run test:unit # 11 database-free conversation/Stop checks
npm test # requires the isolated local Auth/PostgreSQL stack
npm run build
npm run check:artifacts # read-only selected secret scan; build first
npm run test:p9:http
npm run test:household:http
npm run test:phase23:http
npm run test:phase45:http
npm run test:mcp:http
npm run test:http
npm run test:browser
npm run test:phase6:http
npm run test:phase7:http
npm run test:browser:voice # stop your own app first; isolated mocked speech UI
```

For voice browser tests, build first and stop your own app so port 3400 is free, then run `npm run test:browser:voice`. The harness starts and stops its own isolated server with fictional credentials and loopback-only provider endpoints. It uses Chrome's synthetic microphone and mocked speech responses; it makes no real AWS request. Do not run heavy suites concurrently.

Live provider checks are separate: verify credentials with `npx --no-install tsx scripts/check-provider-auth.ts`, then use `DENLUMI_PROVIDER_EVIDENCE_DIR=evidence/phase6 npm run providers:probe` only when authenticated. Generated PCM does not prove human microphone capture or audible playback.

The local Phase 4/5 maintenance worker is a one-shot command; it interrupts expired software sessions, reconciles withdrawn protocols and processes internal-only inbox events:

```bash
npm run workers:phase45
```

Provider probes make real, bounded AWS requests when credentials are available. Bedrock is limited to one request and 96 output tokens in the standalone probe. Never interpret an SDK installation, model listing, or local template response as a successful model invocation.

The full project sequence is in [ROADMAP.md](docs/ROADMAP.md). Phase 0 decisions and actual evidence are in [PHASE_0_HANDOFF.md](docs/PHASE_0_HANDOFF.md).

Phase 4/5 APIs, migrations and evidence limits are in [PHASE_4_5_HANDOFF.md](docs/PHASE_4_5_HANDOFF.md). The browser still presents the disclosed fictional simulation; the P8 W01–W04 management workflows now have local software implementation and verification. New real-mode household records cannot use the demo protocols and have no approved content. All verification uses fictional records, including tests of the live/demo boundary.

Current P8 work and checks are in [P8_WORKFLOWS_HANDOFF.md](docs/P8_WORKFLOWS_HANDOFF.md); earlier provider evidence is in [PHASE_6_7_HANDOFF.md](docs/PHASE_6_7_HANDOFF.md). Private-record operations use the human-only `/api/records` action contract. `/login` accepts existing verified local accounts; `/shared` requires the bound recipient and a recent authenticated session. No email is sent. Anonymous sample users cannot receive verified shares. Expiry denies access but does not erase stored snapshots; household deletion verifies primary database cleanup only, with explicit backup/download limits.

This workspace has no dedicated hosted Supabase project. Only the isolated local stack on ports `55431`/`55432` may be used. Never link a hosted project, push migrations, or deploy from this repository without a later explicit decision.

Current P10 local source reconciliation and exported-folder replay are recorded in [P10_SOURCE_RECONCILIATION.md](docs/P10_SOURCE_RECONCILIATION.md). The owner resumed delivery; [current delivery status](docs/submission/DELIVERY_STATUS.md) separates the source candidate from the public video, pending personal declarations and final submission.

The submission film is [public on YouTube](https://www.youtube.com/watch?v=cbWwUAx-EMU), with selectable English captions. Devpost remains a draft pending owner-entered personal information and final declarations; [manual finish checklist](docs/submission/MANUAL_FINISH.md).

Fresh October 22 setup: a new public-source clone, `npm ci`, cold native service downloads, new database/Auth and the repaired public helper passed 227 domain/Auth/database, 60 typed-browser, 5 mocked-voice, 11 unit, 11 setup and7 export checks, build/typecheck, actual HTTP MCP and9 security checks. [Exact fresh-setup report](docs/P10_CLEAN_SETUP_2026-10-22.md). This is same-Mac native evidence; the Docker VM attempt failed with image-store I/O/journal errors under storage pressure. No independent-machine, Linux, human, practical or live-provider acceptance is inferred.
