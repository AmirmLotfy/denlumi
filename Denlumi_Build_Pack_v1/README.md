# Denlumi - Product and Build Pack v1
Date: 2026-09-16. Prepared for Amir's hardware-free Amazon Developer Hackathon project.

Denlumi is a shared-home companion for cats, dogs, and the people caring for them. It combines species-specific introduction workflows, a household plan, attributed observations, everyday care coordination, and clear professional-help boundaries.

**Brand selection:** Denlumi, pronounced den-LOO-mee. Proposed domain: `denlumi.com`. Neither domain availability/ownership nor trademark clearance is established. An indexed-web screen is not a clearance opinion.

**Artifact status:** This is a product specification, logical data model, contracts, and fictional test fixtures. It is not a deployed application, a clinically validated protocol, or a completed database migration. All bundled protocol examples are `demo_only` and have no professional approval. A software test cannot establish animal safety.

## Read in order
1. `docs/01_brief_and_positioning.md`
2. `docs/02_prd.md`
3. `docs/03_scenario_matrix_and_safety.md`
4. `docs/12_protocol_editorial_spec.md`
5. Architecture, data dictionary, and API/MCP documents.
6. UX/UI, privacy, marketing, and delivery documents.
7. `START_HERE_CODEX.md` and `AGENTS.md` before implementation.

The diagrams are editable Mermaid text. The contracts describe the intended interface, not an assertion that endpoints already exist. Fixtures contain fictional pets and events only. QA definitions are requirements; only the pack validation script has been executed when a validation report is present.

## What is deliberately not promised
No guaranteed compatibility, emotional mind-reading, veterinary diagnosis, physical supervision, certified safe barriers, automatic pet-door control, automatic stage advancement, or native Alexa+ availability.

## Release distinction
- **R0:** A real backend and browser demonstration of all three pairings, single-pet care, household handover, and risk routing. No physical Amazon device needed.
- **R1:** A limited customer pilot after species-specific expert review, operational tests, and privacy/terms review. Only approved modules may guide real-animal sessions.
- **R2:** Additional approved scenario modules, reviewed localization, optional native clients and native Alexa integration when actually available.

Run `python3 qa/validate_pack.py` from this folder to check artifact consistency. This does not test a product backend or any provider integration.
