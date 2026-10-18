# Phase 1 local evidence — 2026-09-22

- `tests.tap`: actual 33/33 domain/auth/RLS/database regression results after a clean migration reset.
- `http.json`: redacted real HTTP proof against the production-built app and local Supabase Auth/PostgreSQL. Cookie-only human actions, same-origin checks, graph creation, role/tenant isolation, stale writes and revocation.
- `advisors.json`: actual local database advisor output. No warning/error or missing foreign-key indexes. INFO unused indexes are retained for planned referential and retrieval workloads; internal/audit tables deliberately deny user access and have no policies.
- `database-lint.json`: command/result record for local public/private schema lint.
- Desktop/mobile PNGs: the existing fictional browser simulation still passes its two browser tests after Phase 1. These do not depict a completed household-management UI.

All test household/pet text and reviewer/support role markers are fictional. Some tests use live-mode coordination records to verify demo/live isolation; they create no approved content or plans. No provider call, actual reviewer, external message, deployment, physical device or real-animal outcome is proved by these files.
