# Security policy

## Supported version

Only the latest commit on `main` and the latest GitHub release are supported during the beta.

## Reporting

Report suspected vulnerabilities privately to the repository owner. Do not include passwords, tokens, cookies, card data, private keys, or unnecessary personal data. Do not test against other users or attempt denial of service.

## Design guarantees

- ChatGPT Sites Auth is the identity boundary; user identity is never accepted from JSON.
- D1 is authoritative for balances, memberships, roles, prices, ownership, purchases, and combat.
- Mutations require same-origin JSON, an idempotency key, bounded schema validation, and server authorization.
- Combat and payment ledgers are append-only and use compensating records for reversals.
- Stripe is test-mode only. The server rejects live keys and live events, verifies raw webhook signatures, and stores no card data.
- Secrets belong only in platform secret storage or ignored `.dev.vars` files.
- Public community surfaces use bounded vocabulary and pseudonymous references; reports redact obvious contact data before storage.

## Residual risk

Automated checks do not replace penetration testing, manual accessibility review, Spanish/EU legal review, payment-operations staffing, moderation staffing, rate limiting at the network edge, or capacity testing. Live payments and large-scale public marketing must remain disabled until those controls have named owners and evidence.
