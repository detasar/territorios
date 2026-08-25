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

## Current task

- Build Stripe sandbox checkout, signed/idempotent webhooks, paid-effect caps, entitlements, refunds, disputes, and spending controls.

## Planned MVPs

1. Recognizable map-first vertical slice with province selection, free support, and one deterministic siege.
2. Durable D1 economy ledger, hourly ticks, conquest, replay, seasons, and leaderboards.
3. Council elections, roles, moderation, notifications, localization, and accessibility.
4. Stripe sandbox purchases, paid-effect cap, entitlements, refunds, and chargeback handling.
5. Full verification, GitHub release, and ChatGPT Sites deployment.

## TODO

- Integrate Stripe test-mode Checkout Sessions without storing card data.
- Fulfill and revoke entitlements only from verified webhook events.
- Enforce personal spend limits, purchase pause, 18+ paid-beta confirmation, refunds, and dispute freezes.
