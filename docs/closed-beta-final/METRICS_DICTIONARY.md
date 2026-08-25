# Closed-beta aggregate metrics dictionary

Run `npm run beta:metrics -- <D1.sqlite> <private-output-directory>`. The command writes owner-readable Markdown and CSV with mode `0600`; output must stay outside Git and participant chat.

All metrics count distinct consented users unless stated otherwise. The denominator is the number of accounts with accepted current-version `beta.consent`. `0` is reported, non-zero cells `1–2` are `SUPPRESSED`, and missing/invalid values are `NOT_AVAILABLE`.

| Metric | Definition |
| --- | --- |
| `participants_consented` | Current-version beta consent accepted |
| `activation_joined` | At least one allowed faction join |
| `first_free_action` | At least one allowed support or accepted role action |
| `front_eligible_now` | Current membership is attacker or defender in an active battle |
| `representative_vote` / `target_vote` | At least one accepted ballot of that fixed kind |
| `role_action` | At least one accepted daily role action |
| `share_opened` | Content-free `share-opened` metric after opening native share or copy fallback |
| `d1_retained` / `d7_retained` | Any later audit activity at least 24 hours / 7 days after consent |
| `client_error_users` | At least one fixed `client-error` metric; no error text is exported |
| `report_submitters` | At least one moderation report |
| `battle_participants` | At least one durable battle order |

The report never selects `users.email`, `users.display_name`, audit `target_id`, `actor_user_id`, IP, request content, or free text. Human task timing, comprehension survey, and help/error codes remain in the separate `P01`…`P15` research sheet and are not inferred from server telemetry.
