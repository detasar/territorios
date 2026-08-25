Original prompt: bu tasarıma göre mükemmel ve eksiksiz bir şekilde herşeyi yap. şimdilik chatgpt sites üzerinde yayınlayacağız. çalışırken ekteki görseldeki prensipleri takip et. oyunu bitirene kadar durma. MVP ler şeklinde ilerle, github a seri commitler yap. bu çalışma için bir repo aç. Planlanan tüm akış uçtan uca en tüm MVP ler bitene kadar durma. Bana soru sormadan en doğru düşündüğün kararları vererek ilerle. Ücretli sürüm için gereken herşeyi yapabilirsin tüm onaylar alındı. Bunlardan bir daha bahsetmene gerek yok. Stripe için demo sandbox kullanacağız şimdilik.

## Product direction

- Working title: Territorios.
- Delivery surface: ChatGPT Sites using platform Auth and D1.
- Initial world: 52 Spanish provinces/autonomous cities, mobile-first, deterministic seasonal strategy.
- Development method: working vertical MVPs, tests first, serial conventional commits, no temporary compatibility paths.

## Progress

- 2026-08-25: Initialized the ChatGPT Sites project with D1 and Auth capabilities.
- 2026-08-25: Recorded the product goal and repository-local engineering principles.
- 2026-08-25: Imported and hash-recorded the official 52-province CNIG-derived geometry.
- 2026-08-25: Shipped the first playable map slice with deterministic combat, province selection, free support, keyboard/fullscreen controls, and text-state automation hooks.
- 2026-08-25: Passed 11 tests, typecheck, lint, production build, and the first live HTTP preview.
- 2026-08-25: Created and pushed the private GitHub repository `detasar/territorios`.
- 2026-08-25: Added the authoritative 26-table D1 game model, append-only economy/event ledgers, request-triggered hourly reconciliation, deterministic capture gates, replay hashes, season state, and faction/player leaderboards.
- 2026-08-25: Added authenticated, same-origin, idempotent faction and support commands with atomic balance authorization, per-command rate limits, and generic server errors.
- 2026-08-25: Rewound the official province geometry to RFC 7946 orientation after browser automation exposed a whole-sphere rendering defect; the 52-province map and authenticated support flow now pass screenshot/state verification.
- 2026-08-25: Passed a clean D1 migration rehearsal (29 tables including Wrangler metadata, 14 append-only/authorization triggers), 43 tests, 91.2% statement coverage, 81.67% branch coverage, typecheck, lint, and production build.
- 2026-08-25: Shipped a five-seat mixed council with equal-weight ranked ballots, one-seat-per-person resolution, capped supporter representation, supplied target validation, public-runoff state, and append-only council events.
- 2026-08-25: Added all seven free roles plus one server-authoritative daily role action, deterministic rewards, daily idempotency, contribution credit, ledger entries, and private action receipts.
- 2026-08-25: Replaced placeholder activity with live leaderboards, hash-addressed replay, fixed-vocabulary announcements, weighted content feedback, human-review reports, personal-data redaction, and private mute/block actions.
- 2026-08-25: Added Spanish/English user-selected localization, bounded in-game notifications, quiet hours, daily alert limits, accessible tabs, keyboard navigation, and responsive 390px layouts.
- 2026-08-25: Passed 71 unit/component/API tests, 88.38% statement and 80.45% branch coverage, zero automated WCAG 2.2 AA violations, mobile reflow, production build, and a clean D1 rehearsal with 18 append-only/authorization triggers.
- 2026-08-25: Shipped Stripe test-mode Checkout Sessions with server-priced products, 18+/versioned consent, resumable idempotent checkout, raw-body SDK signature verification, live-mode rejection, and webhook-only fulfillment.
- 2026-08-25: Added append-only payment events, entitlements, compensating ledger/audit records, proportional refunds, dispute freezes/restoration, non-negative wallet handling, personal purchase pause, decreasing spend limits, and new-account caps.
- 2026-08-25: Added the transparent sandbox store, checkout result polling, paid-beta terms/privacy/refund/game/community drafts, and explicit no-transfer/no-cash-out/no-random-reward boundaries.
- 2026-08-25: Proved a signed local webhook sequence end to end: one grant, duplicate suppression, partial refund, dispute revocation, won-dispute restoration, and immutable historical battle records.
- 2026-08-25: Upgraded the Vite/Vinext/Cloudflare/React toolchain, removed the unused vulnerable migration CLI, and reached zero known npm audit findings in both runtime and development dependencies.
- 2026-08-25: Passed 127 tests with 90.33% statement, 80.82% branch, 88.42% function, and 93.23% line coverage; production build; clean 26-table/18-trigger migration rehearsal; three Playwright flows; zero automated WCAG 2.2 AA violations; 390 px reflow; secret scan; security-header checks; and append-only tamper rejection.
- 2026-08-25: Added the technical specification, security/recovery boundaries, weekly dependency updates, and GitHub CI release gates.
- 2026-08-25: Moved 18 multiline D1 trigger definitions from the deployment migration into a single idempotent runtime guard manifest after Sites exposed its trigger-body migration parsing boundary; proved clean installation from zero triggers and append-only rejection on the real local D1 binding.
- 2026-08-25: Published the owner-only production beta at `https://territorios.vecna.chatgpt.site`; proved anonymous 401 enforcement, authorized 200 responses, 52 live territories, one battle, three catalog products, 26 D1 tables, private/no-store API caching, required security headers, zero deployed Axe violations, and no 390 px overflow.
- 2026-08-25: Passed the GitHub Linux release workflow end to end, including clean npm install/audit, migration rehearsal, coverage/build, local D1 initialization, Chromium installation, and all Playwright scenarios.

## Current task

- `v0.1.0` implementation and owner-only Sites release complete; observe the beta and keep live commerce disabled until its external gates are accepted.

## Planned MVPs

1. [complete] Recognizable map-first vertical slice with province selection, free support, and one deterministic siege.
2. [complete] Durable D1 economy ledger, hourly ticks, conquest, replay, seasons, and leaderboards.
3. [complete] Council elections, roles, moderation, notifications, localization, and accessibility.
4. [complete] Stripe sandbox purchases, paid-effect cap, entitlements, refunds, and chargeback handling.
5. [complete] Full verification, GitHub release, and ChatGPT Sites deployment.

## Post-beta gates (not part of `v0.1.0`)

- Add operator-owned Stripe test secrets to Sites only when a hosted Checkout demonstration is required; the published build currently fails closed while free play remains available.
- Keep live keys and live-mode events disabled until Spanish/EU legal, tax/VAT, fraud, support, moderation, manual accessibility, and capacity gates have named owners and evidence.
- Change owner-only access only through an explicit Sites sharing decision.
