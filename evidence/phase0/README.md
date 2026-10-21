# Phase 0 evidence index

These artifacts use fictional data. They do not establish animal safety, professional review, production readiness, hosted behavior, native Alexa access, microphone capture, or audible playback.

- `http-flow.json`: redacted local HTTP proof. Supabase Auth created distinct owner/caregiver sessions. MCP negotiated `2025-11-25`, completed `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`; the observation raised the safety epoch; the old caregiver request returned HTTP 409 `STALE_STATE`; a fresh conversation retrieved the pause without chat history. The current provider-disabled rerun reports `BEDROCK_NOT_ENABLED` before an AWS request; it does not establish account authorization. Historical provider responses belong to their own dated evidence.
- `providers.json`: historical September 22, 2026 credential-blocked probe output from `us-east-1`. All three clients report `CredentialsProviderError` / expired login; this file contains no successful provider response. Later [Phase 6 provider probes](../phase6/providers.json) are separate dated evidence, not current authorization or human microphone/playback acceptance.
- `desktop-paused.png`: Playwright rendering after pause, stale refusal, fresh retrieval, and local Stop synchronization at 1440 × 900.
- `mobile-entry.png` and `mobile-workspace.png`: 320 CSS-pixel entry and multi-pet workspace renderings. No horizontal overflow was detected.

The supplied build-pack validator was also run in an isolated temporary Python environment: all 17 specification consistency checks passed. Its own output explicitly excludes application behavior, live provider calls, database/RLS execution, rendered accessibility, native Alexa publication, and real-animal outcomes.

Secrets, raw tokens, AWS account identifiers, prompts with private content, and real household data are excluded.

The PNGs in this index are retained historical renderings. New Phase 0 browser captures default to ignored `.local/browser-captures/phase0` (or an explicit private `DENLUMI_EVIDENCE_DIR`), because fresh fictional pages may display a one-time deletion code. Current automated results are in the [P9 operations handoff](../../docs/P9_OPERATIONS_HANDOFF.md); do not relabel these historical images as a current capture.
