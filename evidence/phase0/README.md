# Phase 0 evidence index

These artifacts use fictional data. They do not establish animal safety, professional review, production readiness, hosted behavior, native Alexa access, microphone capture, or audible playback.

- `http-flow.json`: redacted local HTTP proof. Supabase Auth created distinct owner/caregiver sessions. MCP negotiated `2025-11-25`, completed `initialize`, `notifications/initialized`, `tools/list`, and `tools/call`; the observation raised the safety epoch; the old caregiver request returned HTTP 409 `STALE_STATE`; a fresh conversation retrieved the pause without chat history. Its bounded Bedrock attempt reached AWS and was blocked by `ValidationException`.
- `providers.json`: live AWS feasibility result from `us-east-1`. Bedrock is `BLOCKED` with `ValidationException: Operation not allowed`; Polly and Transcribe requests passed with request IDs and generated fictional PCM. Microphone capture and audible browser playback were not tested.
- `desktop-paused.png`: Playwright rendering after pause, stale refusal, fresh retrieval, and local Stop synchronization at 1440 × 900.
- `mobile-entry.png` and `mobile-workspace.png`: 320 CSS-pixel entry and multi-pet workspace renderings. No horizontal overflow was detected.

The supplied build-pack validator was also run in an isolated temporary Python environment: all 17 specification consistency checks passed. Its own output explicitly excludes application behavior, live provider calls, database/RLS execution, rendered accessibility, native Alexa publication, and real-animal outcomes.

Secrets, raw tokens, AWS account identifiers, prompts with private content, and real household data are excluded.
