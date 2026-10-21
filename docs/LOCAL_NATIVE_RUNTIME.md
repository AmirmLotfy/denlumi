# Isolated native Supabase recovery — October 19, 2026

**October 20 runtime hardening update:** the final P9 app checks use task-local Node 22.23.3/npm 10.9.9 and patched dependency pins. See [P9_HARDENING_HANDOFF.md](P9_HARDENING_HANDOFF.md). Earlier recovery results below retain their original runtime and scope; the existing native database service was preserved.

The owner selected local-only Supabase. The original Denlumi Docker profile is absent. Its old credentials and project source remain preserved; no unrelated Docker profile or persistent volume was reused. This attempt creates a fresh fictional database, not a recovery of historic records.

Current official [runtime documentation](https://supabase.com/docs/guides/local-development/docker-and-native-runtimes) supports native services on macOS Apple silicon. This is the same Supabase Auth/PostgreSQL/REST stack, with an experimental process runtime replacing the unavailable Docker VM. It does not authorize a hosted Supabase project. The original Docker instructions remain available for judges with Docker.

## Exact local tool and isolation

- Pinned CLI: **2.121.0**, official npm package `@supabase/cli-darwin-arm64@2.121.0`, SHA-512 `ZvXKj3wW4Kq5/MrG2xdgZeOWETxmUC9jl16X/i/np7u5A/WLuC/L0+KKY5i0eCrTnNwWFpZdlWKzu/J9QgkPgg==` verified before extraction.
- Workspace-private executable: `.local/tools/supabase-2.121.0/supabase`; its companion `supabase-go` is from the same verified archive. Global CLI 2.90.0 and other projects' configuration are unchanged.
- `SUPABASE_HOME` points to this checkout's ignored `.local/native-home`. `SUPABASE_EXPERIMENTAL_STACK=1` enables the documented experimental runtime for these invocations only.
- Existing `supabase/config.toml` supplies exact loopback API/database ports 55431/55432. No auth, scope, RLS or localhost guard was removed. No root config change was needed.
- Actual start arguments: `stack start --runtime native --preparation on-demand --exclude realtime,storage,functions,studio,mail,analytics,pooler --eager --output-format json`.
- Native service artifacts are checksum-verified by the CLI. Observed versions: PostgreSQL archive `17.11.0.004-r1` (server 17.11), Auth `v2.197.0-r0`, PostgREST `v16.4-r0`.

## Credentials and invocation

The original `.env.local` is neither overwritten nor printed. A workspace-private `.local/run-native.mjs` wrapper captures `stack status` in memory, verifies both endpoint hostnames and ports, then injects the current local keys into its child process. Bedrock and speech are forced off. Tests' legacy `--env-file=.env.local` cannot override injected process environment values.

Example in this workspace: `node .local/run-native.mjs npm test`. The wrapper and runtime credentials are intentionally excluded from public source. A fresh judge checkout can use the pinned CLI with the environment variables above, start the native runtime, then run `python3 scripts/configure-local.py` once to create its own mode-0600 `.env.local`. The setup script accepts both legacy CLI status output and the native CLI's nested `env` shape, while refusing hosted endpoints and overwrites. Use `supabase status` with credential output captured privately; never paste its unredacted response in an issue or video.

Startup auto-applied the existing twelve migrations. `npm run db:setup` then seeded the seven fictional `demo_only` protocols, with no approvals. A direct real query verified PostgreSQL 17.11; Auth health returned actual HTTP 200. Runtime startup eventually returned exit 0 after the service downloads. Startup logs are private because the CLI prints local credentials.

## Evidence limits

This is a new experimental native-runtime environment. It cannot establish Docker clean-machine replay, old-data recovery, production hosting, human accessibility/voice acceptance or practical animal safety. Current check outcomes and remaining work are recorded in PHASE_10_HANDOFF.md and redacted evidence/phase10 files. Never promote an intermediate healthy service or partial test run to full acceptance.

Stop only this stack with the same `SUPABASE_HOME`/experimental environment and pinned CLI using `stack stop`. Do not use all-stack stop, destroy, a global Docker-context switch, or the unrelated leadtodeal-verify VM. Keep the data for the next authorized run.
