# Denlumi

Denlumi is a shared-home companion for cats, dogs, and their adult caregivers. This repository contains **locally implemented Phases 0–7**; Phase 6 and 7 provider/human acceptance deferrals are recorded in [the closure report](docs/PHASE_6_7_CLOSURE.md). It includes bounded conversation, optional microphone capture, private factual previews/exports, verified-recipient sharing, archive and household deletion. The fictional local demonstration uses authenticated shared state, observation-driven software pause, stale-caregiver refusal, fresh-conversation retrieval through Streamable HTTP MCP, and a network-free local Stop.

All bundled protocols are `demo_only`. They are not professionally approved and cannot be used as practical guidance for real animals. The browser surface is an **Alexa-style simulation**. It has no native Alexa certification, physical Amazon device, persistent listening, supervision, or device control.

## Local setup

Requirements: tested Node 22.13.1 and npm 10.9.2, Supabase CLI, a running Docker-compatible runtime, and optional AWS credentials for provider probes. Select your Docker context first; `DOCKER_HOST` is respected if your runtime needs it. No hosted Supabase project is needed or permitted.

```bash
npm ci
supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
supabase migration up --local
python3 scripts/configure-local.py
npm run db:setup
npm run dev
```

Open `http://127.0.0.1:3400`. `configure-local.py` writes local credentials to the ignored `.env.local` without printing them. Review `.env.example` before using another environment. Do not use this demo configuration for customer data.

## Current hackathon status — 18 October 2026

The Alexa+ entry uses the permitted simulated-browser path. The [official deadline](https://amazonappdev2026.devpost.com/rules) is **23 October 2026, 12:00 p.m. PDT / 19:00 UTC / 10:00 p.m. Cairo**. Phases 8–9 have substantial local implementation and recorded checks, with human/provider/operational acceptance still open. Phase 10 publication and submission preparation are now authorized. The [submission draft](devpost-submission.md), [readiness checklist](docs/submission/READINESS.md) and [current handoff](docs/PHASE_10_HANDOFF.md) distinguish actual evidence from missing deliverables.

The public presentation in `apps/showcase` is a static site with an original, historical fictional-app screenshot. It does not expose a live backend or collect household data. The actual interactive application remains local-only. All source is licensed under [MIT](LICENSE); third-party rights remain in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Verification

```bash
npm run typecheck
npm run test:unit # 11 database-free conversation/Stop checks
npm test # requires the isolated local Auth/PostgreSQL stack
npm run build
npm run test:household:http
npm run test:phase23:http
npm run test:phase45:http
npm run test:mcp:http
npm run test:http
npm run test:browser
npm run test:phase6:http
npm run test:phase7:http
```

For the voice browser tests, start a separate local server with `SPEECH_ENABLED=true BEDROCK_ENABLED=false npm run dev`, then run `npm run test:browser:voice`. These tests use Chrome's synthetic microphone and a mocked transcription response, never a fabricated AWS success. Stop that server before returning to the normal speech-disabled browser suite. Do not run heavy suites concurrently.

Live provider checks are separate: verify credentials with `npx --no-install tsx scripts/check-provider-auth.ts`, then use `DENLUMI_PROVIDER_EVIDENCE_DIR=evidence/phase6 npm run providers:probe` only when authenticated. Generated PCM does not prove human microphone capture or audible playback.

The local Phase 4/5 maintenance worker is a one-shot command; it interrupts expired software sessions, reconciles withdrawn protocols and processes internal-only inbox events:

```bash
npm run workers:phase45
```

Provider probes make real, bounded AWS requests when credentials are available. Bedrock is limited to one request and 96 output tokens in the standalone probe. Never interpret an SDK installation, model listing, or local template response as a successful model invocation.

The full project sequence is in [ROADMAP.md](./docs/ROADMAP.md). Phase 0 decisions and actual evidence are in [PHASE_0_HANDOFF.md](./docs/PHASE_0_HANDOFF.md).

Phase 4/5 APIs, migrations and evidence limits are in [PHASE_4_5_HANDOFF.md](docs/PHASE_4_5_HANDOFF.md). The browser still presents the disclosed fictional simulation; the broad management screen inventory is Phase 8. New real-mode household records cannot use the demo protocols and have no approved content. All verification uses fictional records, including tests of the live/demo boundary.

Current work and exact executed checks are in [PHASE_6_7_HANDOFF.md](docs/PHASE_6_7_HANDOFF.md). Private-record operations use the human-only `/api/records` action contract. `/login` accepts existing verified local accounts; `/shared` requires the bound recipient and a recent authenticated session. No email is sent. Anonymous sample users cannot receive verified shares. Expiry denies access but does not erase stored snapshots; household deletion verifies primary database cleanup only, with explicit backup/download limits.

This workspace has no dedicated hosted Supabase project. Only the isolated local stack on ports `55431`/`55432` may be used. Never link a hosted project, push migrations, or deploy from this repository without a later explicit decision.
