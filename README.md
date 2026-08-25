# Territorios

Territorios is a mobile-first, seasonal browser strategy game set across the 52 provinces and autonomous cities of Spain. The game is server-authoritative, deterministic, bilingual (Spanish/English), and built for ChatGPT Sites with platform Auth and D1.

This repository contains the complete `0.1.0` paid-beta candidate:

- official CNIG-derived province geometry with recorded provenance;
- multiple deterministic hourly fronts, council-selected campaign cycles, four daily capture windows, replay hashes, season closure/reset, and leaderboards;
- faction membership, seven daily roles, five-seat councils, announcements, reports, privacy controls, and bounded notifications;
- a Stripe **test-mode only** Checkout integration with verified raw-body webhooks, idempotent grants, proportional refunds, dispute freezes, and user-controlled spending limits;
- a hard combat rule that limits paid power to 20% of a side's effective total power;
- WCAG 2.2 AA automated checks and a 390 px mobile reflow gate.

The legal pages are paid-beta drafts and still require Spanish counsel review before any live-money launch. No live Stripe key is accepted by the application.

## Local development

Requirements: Node.js `>=22.13`, npm, and `sqlite3`.

```bash
npm ci
npx wrangler d1 migrations apply site-creator-d1 --local
npm run dev
```

Open `http://localhost:3000/signin-with-chatgpt?return_to=%2F` to use the local ChatGPT Auth simulator. Generated D1 state stays under the ignored `.wrangler/` directory.

### Optional Stripe sandbox

Create an ignored `.dev.vars` file locally:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Forward Stripe test events to `/api/payments/webhook`. The server refuses `sk_live_` keys and `livemode: true` events. Checkout success pages only poll D1; they never grant assets. Only a verified webhook may fulfill a purchase.

## Verification

```bash
npm run verify
npm run verify:migration
npm run verify:campaign
npm run verify:runtime
npm run test:e2e
npm audit
```

`npm run verify` runs lint, type checking, coverage thresholds, and the production build. The migration rehearsal creates a disposable SQLite database and checks 29 application tables, 19 triggers, foreign keys, and integrity. The campaign rehearsal uses a separate disposable D1 instance to prove five council-selected conquests, concurrent reconciliation safety, the next planning round, Crown selection, and season reset. The runtime smoke starts the production build against another disposable D1 and checks 52 territories, eight unique fronts, `combat-2.0.0`, public-data boundaries, province metadata, cache controls, and security headers. The Playwright suite likewise creates and removes its own isolated D1; neither check opens the project-local `.wrangler` database.

## Documentation

- [Technical specification](docs/TECHNICAL_SPEC.md)
- [Closed beta usability gate](docs/CLOSED_BETA_TEST_PLAN.md)
- [Security policy and threat boundaries](SECURITY.md)
- [Implementation ledger](progress.md)
- [Source-data provenance](data/provenance/provinces.json)

## Release boundary

Version `0.1.0` remains an owner-only gameplay beta and a Stripe sandbox integration. The campaign-loop improvements in this worktree are not deployed until the D1 backup/schema rollout is explicitly approved. Territorios is not a live-commerce launch, a financial product, gambling, or a transferable virtual-property system. Support units cannot be traded, cashed out, or transferred between players.
