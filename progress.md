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

## Current task

- Build the authoritative D1 game world, append-only economy, tick reconciliation, capture replay, seasons, and leaderboard.

## Planned MVPs

1. Recognizable map-first vertical slice with province selection, free support, and one deterministic siege.
2. Durable D1 economy ledger, hourly ticks, conquest, replay, seasons, and leaderboards.
3. Council elections, roles, moderation, notifications, localization, and accessibility.
4. Stripe sandbox purchases, paid-effect cap, entitlements, refunds, and chargeback handling.
5. Full verification, GitHub release, and ChatGPT Sites deployment.

## TODO

- Define and migrate the D1 game schema.
- Add authenticated command/query APIs with server-side authorization and idempotency.
- Reconcile deterministic battle ticks and expose replay/leaderboard views.
