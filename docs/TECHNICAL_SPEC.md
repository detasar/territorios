# Territorios technical specification

## 1. Product boundary

Territorios is a persistent, asynchronous strategy game. A season begins with one faction per Spanish province/autonomous city. Players join one faction, contribute free or sandbox-paid support to supplied battles, and compete through deterministic hourly resolution. No browser value is authoritative.

The first release deliberately excludes chat, user-authored political content, player-to-player asset transfers, cash-out, random paid rewards, live payments, and administrator automation. These exclusions keep the product understandable and reduce legal, fraud, moderation, and security risk.

## 2. Runtime architecture

```text
Browser (React/Vinext)
  -> ChatGPT Sites Auth headers
  -> Next-compatible route handlers
  -> request guards + Zod contracts
  -> D1 transactions / deterministic domain functions
  -> append-only ledgers and replay events

Stripe test Checkout
  -> raw signed webhook
  -> Stripe SDK signature verification
  -> semantic + provider idempotency gates
  -> D1 entitlement adjustment
```

| Layer | Responsibility | Authoritative? |
| --- | --- | --- |
| `src/components` | Map, tabs, forms, localization, status rendering | No |
| `src/contracts` | Bounded input/output shapes | Validation only |
| `src/domain` | Pure combat, governance, moderation, notification, and payment rules | Rule authority |
| `app/api` | Auth, origin/idempotency guard, error boundary, HTTP status | Command boundary |
| `db` | Transactions, authorization, reconciliation, projections | State authority |
| D1 triggers | Append-only and mutation invariants | Persistence authority |

The code uses integer units and basis points. There is no floating-point randomness in combat and no client-provided balance, score, role, ownership, price, or payment status.

## 3. World and time model

- World: 52 territories from the CNIG administrative-boundary source.
- Routes: land adjacency plus explicit maritime links for islands and autonomous cities.
- Season engine: `combat-2.0.0`.
- Tick cadence: one logical tick per hour. Requests reconcile any elapsed ticks before returning a snapshot or accepting a command.
- Campaign cadence: target ballot → 15-minute mobilization → active battle → one-hour cooldown → a new round whose origin follows a successful conquest.
- Multiple disjoint fronts may be active at once; a partial unique index prevents two active battles from targeting the same territory.
- Capture gates: 09:00, 14:00, 19:00, and 23:00 in `Europe/Madrid`.
- Capture requirements: siege reaches 10,000 basis points, at least three battle ticks have elapsed, supply is connected, and the current tick is a capture window.
- Replay: canonical JSON input/result, engine version, and SHA-256-addressed event data are stored with every resolved tick/event.

The request-triggered reconciler is sufficient for the beta's traffic model and avoids a second scheduler. Visible clients poll the world every 15 seconds, refresh immediately after the authoritative tick boundary, and poll governance every 30 seconds. A future high-traffic release may add a single scheduled caller, but it must call the same idempotent reconciliation path rather than implement a second engine.

## 4. Combat and economy

Each side has free and paid units. All supply, distance, overextension, fortification, and homeland modifiers are non-negative integer basis points.

```text
freePower = freeUnits * allModifiers
rawPaidPower = paidUnits * allModifiers
paidPower = min(rawPaidPower, freePower / 4)
totalPower = freePower + paidPower
```

Therefore paid power can never exceed 20% of effective total power. Excess paid power remains queued and can become effective only when supported by sufficient free power. The same rule applies symmetrically to attackers and defenders.

Siege movement is derived from each side's share of total effective power. Live ticks apply supply connectivity, route cost, concurrent-front overextension, fortification, homeland, and occupation modifiers. Casualties and siege movement use integers; equal inputs and engine version always produce equal outputs. A battle can never receive a tick whose resolution timestamp predates its scheduled mobilization.

Wallet and combat mutations are atomic. `ledger_entries`, `game_events`, `battle_ticks`, and ownership history provide the accounting/replay trail. D1 triggers reject update/delete attempts on append-only records.

## 5. Identity and command authorization

ChatGPT Sites injects authenticated user headers. The application never accepts a user ID from request JSON. Anonymous users may inspect the world; membership, support, community, preference, and purchase mutations require authentication.

Every JSON mutation except the provider webhook requires:

- `Content-Type: application/json`;
- a same-origin `Origin` header or `Sec-Fetch-Site: same-origin`;
- an `Idempotency-Key` matching `[A-Za-z0-9._:-]{8,128}`;
- a valid Zod command body;
- server-side membership, ownership, role, balance, rate, and policy authorization.

Error responses do not include stack traces, SQL, credentials, provider objects, or personal data. Logs record bounded error type/event identifiers only.

## 6. HTTP surface

| Method and route | Purpose | Auth |
| --- | --- | --- |
| `GET /api/game` | Reconcile and return world/catalog/viewer snapshot | Optional |
| `POST /api/game/join` | Join a faction and choose one of seven roles | Required |
| `POST /api/game/support` | Commit free or paid support to a battle | Required |
| `GET /api/community` | Council, announcements, notifications, viewer controls | Optional |
| `POST /api/community/ballot` | Cast a ranked council/target ballot | Required |
| `POST /api/community/role-action` | Execute the viewer's daily role action | Required |
| `POST /api/community/announcement` | Publish a fixed-vocabulary announcement | Required |
| `POST /api/community/report` | Submit a human-review report | Required |
| `POST /api/community/safety` | Mute/block a pseudonymous user reference | Required |
| `POST /api/community/preferences` | Set language, quiet hours, and alert caps | Required |
| `GET /api/payments` | Return sandbox configuration, controls, and history | Required |
| `POST /api/payments/checkout` | Create/resume an idempotent test Checkout Session | Required |
| `POST /api/payments/controls` | Pause purchases or lower personal limits | Required |
| `POST /api/payments/webhook` | Verify and process Stripe test webhook | Stripe signature |

Snapshots use `Cache-Control: private, no-store`. Mutation schemas live in `src/contracts`; they are the exact machine-readable request contract.

## 7. Community and governance

Each territory has five one-person seats: two public, defense, strategy, and supporter. Seats belong to a dated council term; expired seats are excluded from both authorization and display. Ballots belong to a governance round rather than the whole season, use equal-weight ranked choices, and allow one user to occupy at most one seat. Every campaign has its own target round. Target voting only accepts supplied adjacent routes and exposes tie/no-quorum states rather than silently choosing a winner.

Roles are scout, defender, quartermaster, builder, diplomat, strategist, and herald. Each has one bounded server-authoritative action per day. Rewards, contribution credit, and cooldown receipts are recorded atomically.

Announcements use a fixed vocabulary. Reports use bounded reason codes plus at most 500 characters of optional detail; obvious email/phone-like personal data is redacted before storage. Public surfaces use pseudonymous references. Mute/block lists and notification preferences are private to the viewer.

## 8. Stripe sandbox state machine

The catalog and euro prices come from D1, never from request JSON. Checkout requires 18+ confirmation and the exact legal-consent version. Default limits are EUR 50/day and EUR 150/season, with a EUR 20 cap during a new account's first 24 hours. A user may pause purchases immediately and may lower limits without support intervention.

Accepted fulfillment/reversal events:

- `checkout.session.completed` and `checkout.session.async_payment_succeeded` when paid;
- `checkout.session.expired` and `checkout.session.async_payment_failed` without fulfillment;
- `refund.created` with proportional revocation;
- `charge.dispute.created` with purchase freeze/review;
- `charge.dispute.closed` for won/lost outcomes.

The webhook verifies the signature against the unparsed body with the Stripe SDK and rejects live-mode events. Provider event IDs, payload hashes, purchase transition versions, payment-intent uniqueness, and ledger idempotency prevent duplicate credit. Checkout metadata contains only the internal purchase ID.

Refund/dispute adjustments never make a wallet negative. If spent units prevent full revocation, the purchase enters human review and the deficit is not hidden. Reversals write compensating entries; past battle events are immutable.

## 9. Persistence model

The initial migration creates 29 application tables. Before any world or payment-event access, an idempotent database-guard initializer installs and verifies 19 triggers from the single `db/database-guards.json` manifest. Keeping each trigger in one prepared statement avoids multiline-trigger parsing differences in deployment migrations. Major groups are:

- identity/economy: users, memberships, wallets, ledger entries;
- world: seasons, territories, adjacencies, factions, territory state;
- battle/replay: battles, orders, ticks, ownership history, game events;
- governance/community: governance rounds, council terms/seats/ballots, campaign rounds, announcements/votes, reports/decisions, notifications/preferences, safety actions, role receipts;
- commerce: catalog, purchases, payment events, entitlements, payment audit.

Foreign keys are enabled. Unique indexes enforce command/provider idempotency. Monetary amounts are integer euro cents. Time values are Unix milliseconds except provider event metadata, which is normalized before storage.

## 10. Security headers and browser boundary

Responses set a restrictive Content Security Policy, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a Permissions Policy disabling camera, microphone, geolocation, and browser payment APIs. Form navigation permits Stripe Checkout only. The app does not load third-party analytics, fonts, trackers, or ad scripts.

## 11. Verification gates

Release acceptance requires all of the following:

1. lint and TypeScript pass;
2. unit/component/API tests pass with at least 85% statements, 80% branches, 85% functions, and 85% lines;
3. clean production build;
4. clean migration rehearsal with 29 tables, 19 triggers, foreign-key check, and integrity check;
5. the isolated D1 campaign harness passes five council-selected conquest cycles, concurrent reconciliation, a seventh planning round, season closure, and season reset;
6. the production-runtime smoke passes against a disposable D1 with 52 territories, eight unique fronts, public-data boundaries, province metadata, cache controls, and security headers;
7. Playwright flows pass against a separate disposable D1 at desktop and 390 px without horizontal overflow;
8. Axe reports zero automated WCAG 2.2 AA violations on game, store, and legal pages;
9. `npm audit` reports no known dependency vulnerabilities;
10. secret scan and anonymous deployed-site smoke checks pass.

Automated accessibility testing cannot prove full accessibility. The 8–15 participant [closed beta usability gate](CLOSED_BETA_TEST_PLAN.md), including manual screen-reader, zoom, language, cognitive-load, and real-device checks, remains `NOT_RUN` and is required before a broad public launch.

## 12. Deployment and recovery

ChatGPT Sites supplies Auth and the canonical D1 binding named `DB`. Stripe variables, if enabled for a private sandbox, must be platform secrets and must never be committed or logged.

Before a schema-changing release:

1. export/backup the current D1 database;
2. rehearse the migration on a disposable database;
3. verify integrity and foreign keys;
4. deploy application and schema as one release;
5. smoke-test anonymous world read, authenticated join/support, community, and payment configuration;
6. retain the previous artifact and database backup for rollback.

The `0.1.0` schema is an initial migration and has not been applied to a public production database. Per project policy, obsolete schemas are replaced before first release instead of carrying compatibility migrations.

## 13. Claim ceiling and known launch work

The release demonstrates a complete gameplay beta and a locally verified Stripe test-mode integration. It does not claim:

- legal approval for live sales in Spain or the EU;
- production fraud/chargeback staffing or tax/VAT operations;
- manual assistive-technology certification;
- internet-scale load, denial-of-service, or multi-region recovery testing;
- a configured live or hosted Stripe test account unless platform secrets are explicitly added and a real test Checkout is observed.

Live commerce must remain disabled until counsel, tax, customer-support, moderation, and operational ownership gates are explicitly accepted.
