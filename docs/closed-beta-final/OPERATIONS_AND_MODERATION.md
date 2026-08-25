# Closed-beta operations, moderation, privacy, and incident runbook

Applies only to the invited 18+ no-real-money beta for `v0.2.0-beta.1`.

## Named ownership

| Responsibility | Owner | Coverage |
| --- | --- | --- |
| Controller / privacy | Davut Emre | authenticated in-app access/deletion queue |
| Support | Davut Emre | normal review within 24 hours |
| Moderator / on-call | Davut Emre | urgent threat/doxxing review within 1 hour |
| Appeals | Davut Emre | review within 72 hours |
| Release / incident commander | Davut Emre | owner-only access, rollback, evidence log |

One person holds several roles; this is acceptable only for the 8–15-person private pilot and is a recorded independence risk. Public access remains NO-GO without additional coverage and legal review.

## Queue and participant contact

The UI calls `/api/beta/request` with authenticated identity, a fixed category/code, and an idempotency key. No free-form text is accepted. D1 records an append-only `beta.request` audit event with the random participant ID, category, SLA, and receipt. The operator reviews the queue at the start/end of every test window and at least hourly while invites are active.

Categories: technical support, urgent security, moderation appeal, data access, and data deletion. Outcome communication uses the invited participant contact mapping outside the repository. Reports and exported QA evidence use only `P01`…`P15`.

## Moderation decisions

1. Preserve the report ID and fixed reason; never copy suspected personal data into the incident log.
2. Use existing mute/block for immediate user control.
3. Human reviewer chooses: no action, warning, content restriction, account pause, or site pause.
4. Record decision, rationale code, time, owner, and participant notification time.
5. Appeal receives a new `beta.request` receipt and a fresh human review within 72 hours.

Threat/doxxing: review within one hour; set site access to owner-only during uncertainty. Immediate danger is escalated to appropriate emergency services. Suspected child sexual abuse material must not be downloaded, copied, or redistributed; use the competent authority/provider reporting channel.

## Privacy requests and retention

- Access/deletion request: initial review within 24 hours, identity matched through authenticated account plus receipt.
- Direct account fields and game state: keep through the beta, then delete or unlink direct identifiers within 30 days.
- Report/security/audit records: 90 days after beta closure unless an incident or applicable obligation remains open.
- Backups: rotate/delete within 30 days.
- Consent and rights-request proof: 12 months.
- Aggregate, small-cell-suppressed metrics may be retained without identity mapping.

Individual deletion fulfillment must scrub email/display name, disable the account, remove the operator-only identity mapping, and retain only the minimum pseudonymous event history needed for shared-world integrity/security. Explain any retained minimum in the response. A public launch requires counsel review of this policy.

## Incident and disable procedure

1. Stop invitations; record UTC time, release SHA, deployment version, D1 binding, reporter ID, and severity.
2. Change site access to owner-only. Do not add Stripe keys or expose a workaround deployment.
3. Preserve worker logs and a D1 export/checksum in restricted storage; do not paste secrets or participant identifiers into Git.
4. Classify: security/privacy, destructive state, availability, moderation/safety, or comprehension/payment.
5. If code-only, roll back to the last verified artifact while keeping the matching D1. If schema/data is implicated, restore the preserved old D1 binding/export and matching artifact together.
6. Run authenticated/anonymous smoke, 52 territories, 8 fronts, day 1, release SHA, mutation, and privacy checks.
7. Notify affected invitees with bounded facts and request IDs. Re-open invites only after release/privacy/moderation owners sign the decision.

## Incident log template

```text
INCIDENT_ID:
OPENED_AT_UTC:
DETECTED_BY_PARTICIPANT_ID:
RELEASE_SHA / DEPLOYMENT_VERSION / D1_BINDING:
SEVERITY / CATEGORY:
USER_IMPACT_WITHOUT_PII:
OWNER_ONLY_AT:
EVIDENCE_REFS_AND_HASHES:
CONTAINMENT:
ROLLBACK_OR_RESTORE:
VERIFICATION:
NOTIFIED_AT:
DECISION_OWNER / DATE / SIGNATURE:
```
