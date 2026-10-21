# Local native Supabase setup and evidence — October 22, 2026

Use [judge setup](JUDGE_SETUP.md) for the complete reproducible command sequence. Supabase remains strictly local-only; an experimental process runtime changes how local Auth/PostgreSQL/REST services run, without authorizing a hosted project, customer data or practical animal guidance.

## Current pinned route

The [official runtime documentation](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes) describes supported macOS Apple Silicon and Linux native hosts. Actual Denlumi execution here is **darwin-arm64 only**. Install **Supabase CLI 2.121.0** from an [official installation route](https://supabase.com/docs/guides/local-development/cli/getting-started) using the [matching pinned release](https://github.com/supabase/cli/releases/tag/v2.121.0), verify its checksum and check `supabase --version`. No untested npm-wrapper installation is represented as verified.

Use Git, Python 3, Node **22.23.4** and npm **10.9.9**. From a fresh clone, `npm ci` installs the pinned application dependencies. Ports 3400 and 55430–55432 must be available to this clone's own app/stack. If another stack owns them, use an isolated environment; never reuse its keys/data, terminate unrelated services or weaken the loopback guards.

## Private runtime home, startup and configuration

Use the same checkout and shell environment for startup, helper configuration and stop:

```bash
umask 077
mkdir -p .local
export SUPABASE_HOME="$PWD/.local/native-home"
export SUPABASE_EXPERIMENTAL_STACK=1
mkdir -p "$SUPABASE_HOME"
supabase stack start --runtime native --preparation on-demand --exclude realtime,storage,functions,studio,mail,analytics,pooler --eager --output-format json > .local/native-start.json 2> .local/native-start.log
```

Wait for successful startup. The CLI retrieves/checks native service archives and automatically applies this source's fifteen migrations. Runtime files and start logs may contain credentials, so they remain private and ignored. Do not print an unredacted status response or copy another checkout's environment.

```bash
python3 scripts/configure-local.py
npm run db:setup
npm run dev
```

The public helper now selects **`supabase stack status --output-format json`** under `SUPABASE_EXPERIMENTAL_STACK=1`; legacy **`supabase status -o json`** is retained for the Docker route without that flag. Native output nests connection fields under `env`. The helper validates explicit localhost API/database endpoints on 55431/55432, writes a new mode-0600 `.env.local`, refuses overwrites and withholds subprocess/invalid-status output on failure. New judges need neither a private status adapter nor a private application wrapper. Bedrock/speech are disabled in the generated file.

`npm run db:setup` seeds seven demo_only protocols and no approvals. The application opens at **http://127.0.0.1:3400**. This is a fictional local simulation, without native Alexa, physical animal supervision or successful model inference claims.

Stop your own app with Ctrl-C. Stop only this clone's stack from its repository root with the same two environment variables:

```bash
supabase stack stop > .local/native-stop.log 2>&1
```

The ordinary stop preserves stack data. Do not destroy, use all-stack stop, delete the runtime home or change global runtime settings. In a new terminal, restore this checkout's `SUPABASE_HOME` and `SUPABASE_EXPERIMENTAL_STACK=1` first.

## October 22 fresh-clone validation — actual scope

A new clone of the then-public source at `9ad14228bd9adf1d2a3d6608154146759c9f962e`, fresh `npm ci` under Node 22.23.4, a new private `SUPABASE_HOME` and cold native service downloads were exercised on the **same Mac**. The existing original stack's credentials and private adapter were not reused. Native startup and the fifteen-migration source succeeded.

That run exposed a real portability defect: `configure-local.py` called legacy `status -o json` even with the experimental stack enabled. The coordinator repaired the distributed helper source in both the working tree and clone to choose `stack status --output-format json`, with redacted failure handling. Two added regressions failed before repair; the final setup suite passed **11/11**. The fixed helper then generated the fresh clone's own mode-0600 `.env.local`, and seeding the seven demo_only protocols passed.

The fresh environment subsequently passed 227/227 domain/Auth/database,60/60 typed-browser,5/5 mocked-voice, 11 unit, 11 setup and7 export checks, production build/typecheck, real HTTP MCP and9 HTTP security checks. [Fresh-setup report](P10_CLEAN_SETUP_2026-10-22.md) and [delivery status](submission/DELIVERY_STATUS.md) contain the exact scope and redacted execution record. Existing host Chrome 155.0.8059.85 supports the configured automated browser channel; it was not newly installed. No Linux, independent-machine, Docker, human speech/accessibility, provider or production acceptance is claimed.

The separate October 22 Docker attempt used a task-owned Colima VM and failed with vdb I/O/journal-abort errors under storage pressure. Its owned VM was cleaned up. It supplies no Docker startup or application PASS evidence and did not authorize deletion or reuse of unrelated runtime data.

## Historical October 19 native recovery

The original Denlumi Docker profile was absent. The owner selected local-only recovery; no unrelated VM/volume was reused. This was a fresh fictional database, not restoration of old records.

The coordinator checksum-verified official package `@supabase/cli-darwin-arm64@2.121.0`, SHA-512 `ZvXKj3wW4Kq5/MrG2xdgZeOWETxmUC9jl16X/i/np7u5A/WLuC/L0+KKY5i0eCrTnNwWFpZdlWKzu/J9QgkPgg==`, before extracting its CLI and companion `supabase-go` into ignored workspace tools. This is the recorded historical installation, not an instruction to assume an unverified npm-wrapper install works. Global CLI/configuration and other projects were unchanged.

The historical runtime used the original checkout's `.local/native-home`, experimental flag and the start arguments above. Observed services were PostgreSQL archive `17.11.0.004-r1` (server 17.11), Auth `v2.197.0-r0`, PostgREST `v16.4-r0`. It auto-applied the twelve migrations that existed then and seeded seven demo_only protocols. A direct query verified PostgreSQL 17.11 and Auth health returned HTTP 200.

The original `.env.local` was preserved. A private `.local/run-native.mjs` wrapper queried status in memory and injected that original runtime's keys for its tests; no credentials/wrapper were published. The October 21 exported-folder replay used a private adapter because native stack identity binds the workspace path. Those historical accommodations are not prerequisites for the fresh-clone route above.

October 19 results and the later October 20/21 Node/dependency hardening retain their original execution identities in [P10 handoff](PHASE_10_HANDOFF.md), [P9 operations](P9_OPERATIONS_HANDOFF.md) and [Node security evidence](../evidence/phase10/node-security-2026-10-21.json). Neither those runs nor current native setup establishes Docker replay, old-data/full-platform recovery, human usability or practical animal safety. H01–H08, qualified exact-version practical review and live provider acceptance remain separate gates.
