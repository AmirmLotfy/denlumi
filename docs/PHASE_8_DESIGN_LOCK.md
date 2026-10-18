# Phase 8 product-screen design lock

Date: 2026-09-23. This extends [the accepted Phase 0 direction](DESIGN_REFERENCE.md), not a rebrand. All examples remain fictional, `demo_only`, and explicitly an Alexa-style browser simulation. The user excludes green and purple; those colors are not used for success, status, decoration or gradients.

## Reference research and roles

Live Refero research compared precise neutral productivity, household-care and Todoist style angles. The earlier [Orderful](https://www.orderful.com) reference remains the primary foundation: white working surfaces, gray canvas, near-black type, flat boundaries, 8px geometry and one vermilion action color. A fresh full-style review of [Todoist](https://todoist.com) supports generous action padding and short task-language hierarchy only. [PostHog](https://posthog.com) was reviewed and rejected as a visual foundation: mascots, technical workbench decoration, gradient and green/blue feature colors are wrong for household welfare records.

For actual product screens, the [Sunsama task dashboard](https://refero.design/pages/7a9afeca-9bb2-4b73-afcf-82a9c2b80e52) shows how a narrow navigation rail and readable task rows organize a day; Denlumi borrows the scan order but not calendar columns, progress bars, drag-and-drop or orange time blocks. The [Todoist activity screen](https://refero.design/pages/7cd91870-20ca-4edb-9828-c08ab4247611) remains the attribution reference for History. The [Care.com pet profile screen](https://refero.design/pages/ed2e92a1-13d9-429c-b4f4-02230b882b71) was inspected for named profile grouping, not for its cream/green palette, pill styling or modal-heavy composition. No reference screenshot or font file is copied into the app.

## Phase 8 interface commitment

- Desktop: a 224px navigation column for **Today, Pets, Home, History**, with the current household and disclosure visible. Mobile: the same destinations as a compact, keyboard-operable navigation row; no hidden essential menu. The persistent Stop remains separate and immediately reachable.
- Today: current household update, handover/read state, tasks with attributed report status, and entry points to case/session and private records. A missed or unreported routine never becomes an inferred physical outcome.
- Pets: named/species cards and case pair sheets. One pet has no fake companion; three or more pets expose separate pair contexts. Mixed-species context preserves newcomer direction. No compatibility label or score.
- Home: versioned zones, resources, planned access and last reported arrangements as a list. Planned access is never represented as a sensed physical state. Editing uses a form/list, not a required drag operation.
- History: attributed observations, corrections, handovers and routine reports in time order with separate observed and reported times, uncertainty and source labels. No happiness chart or reward system.
- State language: “reported,” “planned,” “unknown,” “paused,” “needs review,” and “last retrieved” are literal. Demo review never says professional approval. Technical IDs and raw protocol data stay in the optional evidence disclosure.

## Token and interaction rules

Keep `#F5F5F5` canvas, white surface, `#1F1F1F` ink, `#4A5565` secondary, `#E42B0C` primary action, `#9F302F` danger and `#7A4B00` uncertainty; 8px corners, no base shadow, system sans, 16px body/14px support, 48px controls and 56px Stop. CTA vermilion is an action role, never a pet or welfare indicator. Every interactive element needs a visible focus outline and a control boundary independent of decorative borders. At 320 CSS px and 200% zoom, the navigation, action buttons and Stop must wrap without clipping. Reduced motion suppresses nonessential movement.

No photos are required. Initials plus species labels are a complete fallback. Functional record panels are the visual content; do not add animal stock images, decorative sound waves or a generic chatbot landing page.
