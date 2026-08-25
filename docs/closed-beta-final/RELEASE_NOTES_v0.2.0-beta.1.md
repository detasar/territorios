# Territorios v0.2.0-beta.1

This is the first reproducible, no-real-money closed-beta candidate for Territorios. It is suitable for local evaluation and owner-only staging; participant access is still blocked on the documented 8–15-adult human test and owner signatures.

## Run it locally

Requirements: Node.js 22.13 or newer, npm, and `sqlite3` for the full verification suite.

```bash
git clone https://github.com/detasar/territorios.git
cd territorios
npm ci
npm run dev
```

Open `http://localhost:3000/signin-with-chatgpt?return_to=%2F`. The command applies all migrations to an isolated local D1 world before starting the server. No Stripe key is needed or accepted by this release.

## Included

- 52 Spanish provinces/autonomous cities and eight deterministic day-one fronts;
- server-authoritative free support, councils, campaign cycles, hourly combat, capture, replay, Crown selection, and season reset;
- Spanish/English UI, mobile layout, keyboard navigation, dialog focus handling, and color-independent map states;
- 18+ closed-beta consent, privacy/support/moderation requests, bounded notifications, and aggregate no-PII metrics;
- a hard no-money release boundary: store hidden and all payment routes fail closed;
- reproducible desktop, tablet, mobile, 200% zoom, privacy, attacker/defender, and grayscale screenshots;
- an explicit single-active-season database invariant and safe cleanup of the untouched bootstrap duplicate found during staging smoke.

## Automated evidence

- 29 test files / 190 tests;
- coverage: 89.12% statements, 80.71% branches, 90.10% functions, 91.90% lines;
- 29 D1 tables / 19 runtime guards;
- migration integrity, foreign keys, single-active-season conflict rejection, safe duplicate cleanup, and durable-activity preservation;
- five council-selected campaign cycles and six captures through season rollover;
- fresh concurrent day-one bootstrap with 52 territories and eight fronts;
- four Playwright/Axe flows, including 390 px reflow;
- zero known npm audit vulnerabilities.

The immutable tag target, GitHub release target, and Sites deployment source revision are the authoritative release SHA and must match before this note is published.

## Hosted boundary

Owner-only staging: <https://territorios-closed-beta.vecna.chatgpt.site>

The prior owner-only site and D1 remain the rollback point. The staging deployment contains no Stripe environment variables and is not a public gameplay launch.

## Known gates

- Real 8–15-person moderated and seven-day evidence: `NOT_RUN`.
- Human release, QA, privacy, and moderation signatures: `NOT_RUN`.
- Participant/public sharing: `NO-GO` until those gates pass.
- Real-money operation: out of scope and `NO-GO`.

See the [release pack](README.md), [participant guide](PARTICIPANT_GUIDE.md), and [GO/NO-GO checklist](GO_NO_GO_CHECKLIST.md) for the exact boundaries.
