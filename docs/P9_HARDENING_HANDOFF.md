# P9 dependency and security hardening — 20 October 2026

Owner scope: fix the remaining local dependency/security gaps and run the automated checks after P8 W01–W04. This handoff records local software evidence only. P9 human, provider and operational acceptance is separate. Supabase remains local-only, all practical content remains `demo_only`, and YouTube upload remains paused.

## Implementation and decisions

The final dependency pins are Next.js **16.4.2**, MCP SDK **1.32.1**, React/React DOM **19.3.1**, with compatible transitive overrides for sharp **0.35.5**, Hono **4.13.11** and source-map-js **1.2.2**. The lockfile includes the matching Next/SWC and sharp/libvips platform packages. AWS, Supabase, database and testing stacks retain their existing direct versions. No automatic audit fix, major framework migration or provider call was used.

The original audit flagged five packages (one critical, three high, one moderate). An intermediate 16.3.8/MCP update cleared that feed, but maintainer review found the [October 14 Next.js upstream update](https://nextjs.org/blog/nextjs-security-update-october-14-2026), including bundled React Server Components fixes absent from the audit result. The final pin therefore advances to 16.4.2. Version matching is not proof that this application exposes every affected API. No exploit against the upstream vulnerabilities was attempted. The [MCP session advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-22jm-h49p-29qw) and [HTTP redirect advisory](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw) require 1.32.0 or later; experimental tasks are not enabled here.

The system Node **22.13.1** is unchanged. Final application checks use a task-local **22.23.3** binary with bundled npm **10.9.9**, downloaded from the [official release](https://nodejs.org/en/blog/release/v22.23.3) and checked against its published SHA-256 (`23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53`). This is checksum verification over HTTPS, not independent GPG verification. `.nvmrc`, `.node-version`, package engines and setup instructions record this baseline. [Node announces another security release on or shortly after October 21](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases); its patches are not yet available at this check. Recheck and update before release. A zero npm audit count does not audit the Node runtime, system packages or bundled framework internals completely.

Security corrections:

- JSON requests enforce **16,000 UTF-8 bytes** while streaming and cancel overflow. Declared oversized/malformed/mismatched lengths, non-JSON media types and invalid JSON/UTF-8 fail with structured errors. Normal product text limits remain below this transport budget.
- All household, case, caregiver and session-history GET surfaces share the **120/minute actor read budget**, separate from the **30/minute consequential-write budget**. Existing cookie-only routes stay cookie-only; previously accepted bearer reads and cookie precedence are preserved. These are process-local limits for the local app, not a distributed deployment control or a pre-authentication network firewall.
- Stateful MCP transports reserve admission during initialization, cap **eight per profile / 100 total per process**, and expire idle entries after **15 minutes** on subsequent traffic. The profile cap spans login sessions, while each transport remains bound to both its profile and exact authenticated login session. Busy entries are not evicted by idle pruning.
- Every MCP response is `no-store`. The app orchestrator explicitly sends DELETE before closing the client. Failed/aborted network cleanup falls back to bounded expiry and does not replace an already completed action result.
- A reproduced SDK batch/cancellation hang is refused with `MCP_BATCH_NOT_SUPPORTED` before work. The [pinned MCP 2025-11-25 transport contract](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) accepts one JSON-RPC message per POST. An independent 10-second server deadline and request-abort path dispose stuck transports and restore admission. Timeout/abort is not a claim that an already dispatched database action rolled back; current state and existing idempotent receipts remain authoritative.
- `release:prepare -- --check` / `check:artifacts` scans allowlisted source and emitted browser assets for selected credential patterns and known local secret values, without refreshing the publication checkout or manifest. It is a limited leak check, not exhaustive private-data inspection. Normal publication preparation still remains a distinct explicit operation.
- `test:browser` now includes the existing Phase 8/9 suites that were omitted from its default command. The separate voice suite uses synthetic/mocked audio; live provider scripts remain explicit.

## Actual verification

Final integration results are recorded below after execution; private raw logs are under `.local/p9-hardening-2026-10-20/`. Earlier iterations remain there, including the reproduced failure logs. No planned acceptance criterion is a pass.

| Executed check | Actual result |
|---|---|
| Final domain/Auth/database suite on Node 22.23.3 | **198/198 passed**, zero skipped; 284,846.710375 ms |
| Production typed-browser suite | **60/60 passed**, 3.3 minutes |
| Isolated synthetic/mocked voice suite | **5/5 passed**, 20.8 seconds; no real provider endpoint or credential |
| Existing HTTP proofs: Phase 0, household, P2/3, P4/5, MCP, P6, P7 | All **seven commands passed** against the production app and real local Auth/database |
| New production HTTP security proof | **9 checks passed**, including exact on-wire Host refusal |
| Pairing HTTP/MCP trace | **Seven fictional shapes passed** |
| Typecheck and production build | **Passed**, Next 16.4.2 |
| Local credential/setup boundaries | **6/6 passed**, fake CLI output only |
| Local database schema lint | **Passed**, no schema errors found |
| Lockfile audit / installed dependency tree | **Zero known audit vulnerabilities** / valid installed graph |
| Selected source/browser credential scan | **Passed**, read-only; final scan and source hashes in the redacted evidence |
| Consented demo cleanup / private view-session pruning | Both **read-only dry runs passed**; zero due consented demos; 320 older unconsented expired fixtures excluded; 32 eligible expired view rows counted, none deleted |
| Local synthetic latency/feedback/Stop | 12 samples each: graph HTTP p95 **18 ms**, current-plan MCP HTTP p95 **109 ms**, loading acknowledgment p95 **8.7 ms**, Stop handler p95 **1.2 ms**, stopped UI p95 **4.7 ms**; local targets met |
| Real app-to-Postgres configuration failure and recovery | **Passed**, four assertions; task-owned app restarted with valid/nonexistent/valid local database names. Shared database service stayed running; this is not backup restoration |

Tests-first failures are retained: JSON body cases **0/8 before → 8/8 after**; mixed read-budget cases **2/4 before → 4/4 after**; initial MCP admission/cache/expiry cases **1/5 before → 5/5 after**, then expanded to ten passing cases. Independent review found the batch/cancellation hang; execution reproduced `HUNG`, and an aborted case could not settle. Batch refusal plus abort/deadline cleanup closed that gap. The earlier 195-test and 198-test runs on Node 22.13.1/Next 16.3.8 are intermediate results, superseded by the final runtime run above.

Two harness failures are also preserved rather than presented as product defects or passes. The initial voice command ran against disabled speech UI: two failed, one passed, one interrupted, one not run. The replacement self-owned voice harness exposes speech UI while stripping inherited AWS settings, supplying fictional keys/empty config and forcing AWS SDK endpoints to loopback port 9; Playwright skips dotenv reloading in that isolated mode. Successful speech responses remain browser mocks. Independent source review found and closed the dotenv reintroduction gap before the successful run. Separately, Node fetch ignored the initial test's Host override, producing schema rejection instead of the intended host probe. A raw `node:http` request now verifies the exact Host header and expected 403, without weakening the guard.

See [redacted P9 evidence](../evidence/phase9/hardening-2026-10-20.json) for the final hashes and actual execution summary.

## Files changed

Dependency/runtime configuration: `.node-version`, `.nvmrc`, `package.json`, `package-lock.json`.

Request/session boundaries: `apps/web/lib/http.ts`, `household-http.ts`, `mcp.ts`; API routes for `households` index, household brief/graph/planning/memberships/routine-rules, case context, caregiver brief/planning, MCP and assistant turn. Existing session-history, inbox and routine-occurrence routes already use the shared guard.

Regression/operation tooling: `tests/http-security.test.ts`, `tests/mcp-security.test.ts`, `tests/p9-read-budgets.test.ts`, `scripts/prove-p9-security-http.ts`, `scripts/prove-phase45-http.ts`, `scripts/prepare-public-release.mjs`, `scripts/run-mocked-voice-check.mjs` and `playwright.config.ts`. The voice command requires a free app port and owns/cleans its own isolated server; it never stops an existing app. Setup/status documentation and the local static showcase runtime text are updated, along with the redacted phase evidence. No public snapshot was refreshed. Existing HTTP proof evidence may receive a fresh fictional localhost result; no private credentials or user content are intended for public artifacts.

## Remaining gates and smallest next action

The local automated result does not close human screen-reader/native zoom/supported-device/non-audio/voice usability, exact-version professional content review, live provider latency/cost/retention, policy-reviewed table-by-table metadata retention, continuously operated consented cleanup, full-platform backup expiry/restore, clean-machine Docker replay, or an operational-scale withdrawal drill. No destructive metadata purge or retroactive cleanup of old unconsented fixtures is authorized by this hardening pass. Existing native recovery evidence does not establish restoration of older records.

The most recent AWS identity evidence reported expired login; Bedrock authorization is **unknown**, not enabled or disabled by this pass. Renewed owner login is required before a current availability check; inference/account/IAM/billing changes remain separate. The film remains local, and public source/showcase snapshots have not been refreshed.

Next smallest software action: recheck the announced October 21 Node security release, pin and regression-test the patch once available. The next P9 acceptance work is a supported-device human task pass and a table-by-table retention decision; prepare that review from the existing policy draft without purging data. P10 source reconciliation, film review and submission retain their own gates and upload pause.

Coordinator: this chat, actual cwd `<local-workspace>`, branch `main`, unborn HEAD, original project still untracked. Preserve ignored native credentials, dependency caches, the existing native Supabase service and all unrelated work. No migration, provider resource, hosted service, public push/deployment or submission is part of this change.

## Final checkpoint and local continuation

Task-owned production, isolated voice, recovery-app and browser processes have stopped; port 3400 is free. The pre-existing native Supabase host (PID 33598) remains running. The final read-only artifact scan passed **340 source inputs / 15 emitted browser assets**. Its retained 281-file publication checkout, publication manifest and local submission film were verified unchanged. The 51 listed source/evidence hashes were checked against disk.

Kerno checkpoint/recovery did not establish a resumable packet: it recorded its plugin cwd and validation returned `reconciliation-required` for a stale indexed snapshot. This on-disk handoff and the freshly verified source/evidence manifest are authoritative for continuation; do not claim tool recovery validation passed. No successor or ownership transfer was created.

For a human local pass in this existing Apple Silicon workspace, select the tested task-local runtime before starting the normal provider-disabled app:

```bash
export PATH="$PWD/.local/tools/node-22.23.3/node-v22.23.3-darwin-arm64/bin:$PATH"
node .local/run-native.mjs npm run start
```

This command depends on the preserved private native wrapper and running local stack; it is not a clean-machine setup claim. Stop your own app before `node .local/run-native.mjs npm run test:browser:voice`, which owns its isolated server and refuses an occupied port. Ordinary AWS access and the system Node installation remain unchanged.

**Release availability recheck:** at 2026-10-20 21:00:53 UTC (October 21 in Africa/Cairo), the official Node distribution index still lists **22.23.3** as the latest 22.x release. The announced October 21 security patch is not available in that check; no nonexistent patch or security acceptance is claimed. Recheck before release rather than treating the local-date rollover as evidence that the patch shipped.
