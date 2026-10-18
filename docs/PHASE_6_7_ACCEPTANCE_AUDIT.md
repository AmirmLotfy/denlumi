# Phase 6/7 acceptance audit

**2026-10-01 Current acceptance disposition:** Local implementation closed with explicit deferrals. The current source passed the 58-test domain selection, 2 real-Auth logout tests, typecheck/build, 6 production-browser tests and both authenticated HTTP proofs. Cross-sample drafts/captions, late speech/sync responses, partial logout retry and the six-call total MCP budget are fixed. AWS recheck failed with an expired session; no fresh authorization or inference result exists. Read [PHASE_6_7_CLOSURE.md](PHASE_6_7_CLOSURE.md) for authoritative status, limits and exact changes. Earlier counts below are historical.


**Current status (2026-09-22 21:25 UTC):** Local Phase 6 and 7 implementation is closed with Bedrock, human voice and operational acceptance deferred; see [PHASE_6_7_CLOSURE.md](PHASE_6_7_CLOSURE.md). The final local suite passed 87/87, typecheck and production build passed, and both phase-specific authenticated HTTP proofs passed again against the production build. The table below is a historical evidence audit, including its earlier test count.

Update (2026-09-22 20:58 UTC): Opt-in live browser speech test passed 1/1 using a synthetic Chrome microphone WAV and real authenticated Amazon Transcribe/Polly app requests. Chrome started audio playback and local Stop paused it while offline. This closes the software transport/playback-interruption check under synthetic input only. Human microphone and audible perception remain untested. The AWS identity is the account root user outside Organizations; Nova Micro still reports `NOT_AUTHORIZED` despite an active inference profile. The Bedrock model tool loop remains blocked. See `evidence/phase6/voice-browser.json` and `docs/AWS_BEDROCK_SUPPORT_DRAFT.md`.

Latest override (2026-09-22 20:43 UTC): AWS authentication recovered. Real Polly/Transcribe standalone and authenticated app HTTP probes PASS (`evidence/phase6/providers.json`, `speech-http.json`). Bedrock invocation remains blocked by `Operation not allowed`; model availability reports `NOT_AUTHORIZED`. The expired-session references in the original audit table below are historical. No successful Bedrock tool loop or human microphone/audible playback proof exists yet.

An actual authenticated app conversation with `use_model=true` at `20:45:45Z` recorded one blocked AWS Bedrock request and a current MCP/database fallback (`evidence/phase6/bedrock-app.json`). This proves error handling under the present denial, not model tool use. No repeat invocation is needed before authorization changes.

Audited against PRD FR-13/15/17, architecture, API/MCP, security/privacy and the canonical roadmap on 2026-09-22. This audit does not mark the active goal complete.

| Requirement | Evidence inspected and executed | Result |
|---|---|---|
| Real authenticated HTTP MCP and current plan | `scripts/prove-phase6-http.ts`, `evidence/phase6/http.json`; actual initialize/list/call trace | PASS locally |
| Fresh conversation sees committed pause; stale caregiver refused | Same HTTP proof; existing desktop browser flow; state/session tests | PASS locally |
| Nine bounded tools; model cannot confirm, advance, clear, share, invite or actuate | `apps/web/lib/mcp.ts`, `packages/domain/conversation.ts`, four conversation tests and state permission tests | PASS locally; real Bedrock-driven execution remains open |
| AT062 denied mic retains typed workflow | `tests/e2e/phase6.spec.ts`, injected permission denial plus real local typed MCP | PASS in tested Chrome |
| AT063 ambiguous identity/pronouns, explicit human selection | Conversation tests use similar names and duplicate aliases; browser requires explicit actor/assertion review, preserves raw negated report and unknown observation time | PASS locally; real speech recognition of names untested |
| AT064 barge-in/Stop | Browser synthetic capture stops offline; local-stop tests cancel current/queued output and abort work; code gates late output by generation/epoch | Local tests PASS; human audible playback/interrupt remains unverified |
| AT065 model/speech outage fallback | Disabled-Bedrock browser test and provider domain test preserve manual controls; mic error fallback tested | PASS for exercised failures; actual provider outage response not newly invoked |
| AT066 no reliance on chat history | Fresh HTTP conversation after committed pause with different conversation ID and current epoch | PASS locally |
| AT067 forbidden tools/forged scope | Whitelist, prototype-key, extra-argument and cross-household/case validation tests; real tenant isolation tests | PASS locally |
| Bounded push-to-talk, captions and audio transport | AudioWorklet synthetic PCM upload; direct authenticated audio-boundary test; real app Transcribe/Polly HTTP requests; opt-in live browser speech test with synthetic microphone WAV | PASS for synthetic-input software path; human microphone and audible perception remain open |
| Raw audio/draft retention | PCM transient in browser/server, no raw storage path; first voice deadline cannot be extended by another recording; browser clock advances across both captures and verifies draft erasure | Denlumi local behavior PASS; provider retention configuration unverified |
| Real Bedrock and speech requests | Real provider probe and app requests in `evidence/phase6/providers.json`, `bedrock-app.json`, `speech-http.json`, `voice-browser.json`; fresh read-only Nova Micro availability on 2026-09-23 still `NOT_AUTHORIZED` | Speech PASS; Bedrock request attempted but model inference BLOCKED. No successful model tool loop. |
| FR-13 factual private summary, sources, uncertainty and corrections | Thirteen Phase 7 domain tests, immutable content/digest, escaped HTML; original/corrected reports both retained | PASS locally |
| Exact owner preview and single-use authorization | AT042 test changes destination/content/format/scope/expiry; replay, fresh auth, transfer and protocol withdrawal tests; owner browser flow | PASS locally |
| Private text/HTML download, AT044 guessed asset denial | Private DB export, owner download checks, Data API default deny, foreign export denial, actual browser attachment | PASS locally; no storage-provider integration claimed |
| AT043 verified recipient, expiry and immediate revocation | Actual expired fixtures, session/recipient/revocation tests; real HTTP and verified recipient browser sign-in/view/revocation | PASS locally |
| AT034 archive/history | Attributed report retained; rules/tasks/session dependencies canceled; subsequent occurrence generation excludes archived pet; owner browser archive | PASS locally |
| FR-17 deletion/visible processing/failure | Request denies reads first; scoped cleanup verifies primary absence; unknown tenant table causes visible failure then retry; HTTP/browser completion | PASS for supported whole-household deletion; account identity/backups/downloaded copies explicitly outside scope |
| Same-origin human authorization; no model external action | Cookie-only `/api/records`, `/login`, `/shared`; only read-only summary helper in MCP; actual auth/isolation tests | PASS locally; no external send |
| Demo-only content, simulation labeling, local-only Supabase | Existing server content gates and tests, browser labels, AGENTS rule 15, runtime DB/Auth loopback guards; no project-ref link | Preserved; no professional approval/native Alexa/deployment claim |

Actual command counts and evidence limits are in [PHASE_6_7_HANDOFF.md](PHASE_6_7_HANDOFF.md). The missing real provider and human voice observations prevent full completion. Other platform/accessibility/operational targets remain assigned to their later roadmap phases, not silently reported as passed here.
