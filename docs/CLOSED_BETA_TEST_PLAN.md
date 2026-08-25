# Closed beta usability gate

Status: `NOT_RUN` — this gate requires 8–15 consented human participants and cannot be satisfied by automated tests.

## Purpose

Validate that a first-time player can understand the map, choose a province and seasonal role, make a free contribution, recognize which fronts they can support, and understand the council/replay/share surfaces without operator coaching. This is a broad-public-launch gate, not evidence that the deterministic game engine is correct.

## Participants and environment

- Recruit 8–15 adults who have not used the build before; include both strategy-game and non-strategy-game players.
- Include at least four mobile sessions at 390–430 px, two keyboard-only sessions, and Spanish plus English UI sessions.
- Use an owner-only staging deployment backed by a disposable or separately backed-up D1 database.
- Keep Stripe in sandbox/fail-closed mode. Do not collect real payment details or ask participants to make a purchase.
- Obtain explicit consent for observation or recording. Assign random participant IDs and never put names, email addresses, ChatGPT identifiers, cookies, or free-form private content in the report.

## Moderated task script

The moderator reads each goal without naming the control to use and does not help unless the participant is blocked for 90 seconds.

1. Open the game and explain what is happening on the map.
2. Choose a province that matters to you.
3. Choose a seasonal role and explain what effect it has.
4. Complete the first available free contribution.
5. Switch between active fronts and identify one you can and one you cannot support.
6. Find the next campaign target vote and explain what happens after it closes.
7. Read one replay event and describe the result in ordinary language.
8. Share the selected province without actually sending the message.
9. Find language, notification, and legal/payment-boundary controls.

## Measurements

Record only the following per task: completion (`yes/no`), completion time, number of wrong turns, whether moderator help was required, and a short problem code from a controlled vocabulary. After the tasks, ask 1–5 questions for map clarity, role clarity, next-action clarity, visual quality, and trust in the sandbox/payment explanation.

## Acceptance thresholds

- At least 80% complete province selection, role selection, and a free action within three minutes without help.
- At least 90% correctly explain why a support action is enabled or disabled for a selected front.
- At least 80% find the council target vote and describe the planning → mobilization → battle loop.
- At least 75% correctly explain their role effect and one replay result.
- At least 80% find the province share action and understand that its link opens that province.
- No participant mistakes sandbox support for cash, transferable property, a random prize, or guaranteed financial value.
- No critical blocker for keyboard-only, mobile reflow, zoom, or screen-reader use. Automated Axe results are supporting evidence only.

Any failed core threshold, misleading payment interpretation, destructive data issue, authorization leak, or inaccessible core action blocks broad public launch. Cosmetic preferences become prioritized follow-ups rather than automatic blockers.

## Evidence and decision record

Publish an anonymized aggregate with participant count, device/input/language mix, task denominators, exact success rates, median completion times, categorized observations, and the build commit tested. Separate observed facts from product hypotheses. Keep the raw session material only for the consented retention period, then delete it. Mark this gate `PASS` only after fixes are retested against the failed tasks; otherwise keep it `NOT_RUN` or `FAIL`.
