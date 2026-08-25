# Territorios — Closed Beta GO / NO-GO Checklist

## Karar kapsamı

Bu checklist yalnız **8–15 yetişkin katılımcıya, gerçek para içermeyen closed beta erişimi** için kullanılır.

Aşağıdaki kararları vermez:

- ücretsiz public beta;
- influencer/press launch;
- canlı Stripe veya herhangi bir gerçek ödeme;
- 18 yaş altı erişim;
- belediye/ilçe katmanı.

## Durum değerleri

- `PASS`: kanıt var ve kriter geçti.
- `FAIL`: kriter geçmedi.
- `NOT_RUN`: henüz test edilmedi.
- `WAIVED`: yalnız risk owner, gerekçe, son tarih ve telafi kontrolüyle; P0 güvenlik/privacy/payment kriterlerinde waiver yok.

## 1. Release identity

| Kontrol | Durum | Kanıt | Owner |
| --- | --- | --- | --- |
| Candidate version `v0.2.0-beta.1` | NOT_RUN |  |  |
| Candidate immutable SHA kaydedildi | NOT_RUN |  |  |
| Package/tag/deployment aynı SHA | NOT_RUN |  |  |
| Eski `v0.1.0` tag’i değiştirilmedi | NOT_RUN |  |  |
| Release note “closed beta / no real money” diyor | NOT_RUN |  |  |

**Gate:** Her satır PASS.

## 2. Database ve world

| Kontrol | Durum | Kanıt | Owner |
| --- | --- | --- | --- |
| Mevcut D1 export ve checksum | NOT_RUN |  |  |
| Clean beta D1 veya gerçek `0001` migration | NOT_RUN |  |  |
| 29 table / 19 trigger | NOT_RUN |  |  |
| Foreign-key/integrity OK | NOT_RUN |  |  |
| Fresh world day 1 | NOT_RUN |  |  |
| Tek active season | NOT_RUN |  |  |
| 52 territory | NOT_RUN |  |  |
| 8 unique opening front | NOT_RUN |  |  |
| `combat-2.0.0` | NOT_RUN |  |  |
| Duplicate bootstrap/front yok | NOT_RUN |  |  |
| Rollback/restore rehearsal | NOT_RUN |  |  |

**Gate:** Her satır PASS. D1 waiver yok.

## 3. Oynanabilirlik

| Kontrol | Durum | Kanıt | Owner |
| --- | --- | --- | --- |
| Province→role→first action progressive onboarding | NOT_RUN |  |  |
| İlk destek impact feedback | NOT_RUN |  |  |
| `My fronts / Other fronts` grouping | NOT_RUN |  |  |
| Eligible front default | NOT_RUN |  |  |
| Observer yanlış support CTA görmüyor | NOT_RUN |  |  |
| Selected province ve active battle ayrımı | NOT_RUN |  |  |
| Role effect ve cooldown görünür | NOT_RUN |  |  |
| Campaign phase/player language | NOT_RUN |  |  |
| Crown progress ve symbolic value | NOT_RUN |  |  |
| 4–6 focus province cohort planı | NOT_RUN |  |  |

**Gate:** İlk altı satır ve cohort planı PASS; diğerleri en az conditional PASS.

## 4. Görsel semantik

| Kontrol | Durum | Kanıt | Owner |
| --- | --- | --- | --- |
| 52 faction için yanıltıcı beş-renk tekrar sorunu kapalı | NOT_RUN |  |  |
| Same-faction cluster okunuyor | NOT_RUN |  |  |
| Own/origin/target/contested/selected ayrı | NOT_RUN |  |  |
| Legend gerçek state modelini anlatıyor | NOT_RUN |  |  |
| Placeholder `Casa del Mar/Liga Dorada` yok | NOT_RUN |  |  |
| Resource strip gerçek source ile eşleşiyor | NOT_RUN |  |  |
| Province crest owner/state ile eşleşiyor | NOT_RUN |  |  |
| Grayscale/color-vision check | NOT_RUN |  |  |
| 390/768/1440 screenshots accepted | NOT_RUN |  |  |
| 200% zoom core action görünür | NOT_RUN |  |  |

**Gate:** İlk altı ve viewport kanıtı PASS. P0 visual semantics waiver yok.

## 5. Automated engineering gates

| Komut/kanıt | Durum | Sonuç |
| --- | --- | --- |
| `npm ci` | NOT_RUN |  |
| `npm audit` — 0 vulnerability | NOT_RUN |  |
| `npm run verify:migration` | NOT_RUN |  |
| `npm run verify:campaign` | NOT_RUN |  |
| `npm run verify` | NOT_RUN |  |
| `npm run verify:runtime` | NOT_RUN |  |
| `npm run verify:bootstrap` | NOT_RUN |  |
| `npm run test:e2e` | NOT_RUN |  |
| Coverage ≥85/80/85/85 | NOT_RUN |  |
| Axe 0 automated violation | NOT_RUN |  |

**Gate:** Tümü aynı SHA’da PASS.

## 6. Deployed staging smoke

| Kontrol | Durum | Kanıt |
| --- | --- | --- |
| Correct deployment SHA/version | NOT_RUN |  |
| Owner-only access | NOT_RUN |  |
| Anonymous world/private viewer boundary | NOT_RUN |  |
| Auth sign-in/return | NOT_RUN |  |
| Join + 300 free support | NOT_RUN |  |
| Attacker support | NOT_RUN |  |
| Defender support | NOT_RUN |  |
| Polling sync | NOT_RUN |  |
| Role action | NOT_RUN |  |
| Representative/target governance | NOT_RUN |  |
| Announcement/report/mute/block | NOT_RUN |  |
| Replay/share/locale | NOT_RUN |  |
| Store hidden veya explicit fail-closed | NOT_RUN |  |
| Security headers/no-store | NOT_RUN |  |
| Console/network P0/P1 yok | NOT_RUN |  |

**Gate:** Tümü PASS.

## 7. Accessibility

| Kontrol | Durum | Kanıt |
| --- | --- | --- |
| Keyboard core flow | NOT_RUN |  |
| Map roving navigation | NOT_RUN |  |
| Dialog focus/Escape/return | NOT_RUN |  |
| 390 px no overflow/overlap | NOT_RUN |  |
| 200% zoom | NOT_RUN |  |
| Reduced motion | NOT_RUN |  |
| Screen-reader core smoke | NOT_RUN |  |
| Color-independent state | NOT_RUN |  |
| Spanish/English lang/labels | NOT_RUN |  |

**Gate:** Critical core flow satırları PASS; screen-reader mümkün değilse risk owner + scheduled test gerekir, public GO verilemez.

## 8. Privacy ve participant operation

| Kontrol | Durum | Kanıt | Owner |
| --- | --- | --- | --- |
| Controller/operator adı | NOT_RUN |  |  |
| Privacy contact | NOT_RUN |  |  |
| Support/security contact | NOT_RUN |  |  |
| Purpose/legal basis/processor summary | NOT_RUN |  |  |
| Retention/deletion policy | NOT_RUN |  |  |
| Access/delete request route | NOT_RUN |  |  |
| Participant consent | NOT_RUN |  |  |
| Random participant ID planı | NOT_RUN |  |  |
| Raw material deletion date | NOT_RUN |  |  |
| No real payment notice | NOT_RUN |  |  |

**Gate:** Tümü PASS; privacy waiver yok.

## 9. Moderation ve incident

| Kontrol | Durum | Kanıt | Owner |
| --- | --- | --- | --- |
| Named moderator/on-call | NOT_RUN |  |  |
| Report review SLA | NOT_RUN |  |  |
| Threat/doxxing/child-safety escalation | NOT_RUN |  |  |
| Appeal route | NOT_RUN |  |  |
| Read-only/disable procedure | NOT_RUN |  |  |
| Incident log template | NOT_RUN |  |  |
| Test report rehearsal | NOT_RUN |  |  |
| Access revoke procedure | NOT_RUN |  |  |

**Gate:** Tümü PASS.

## 10. Observability ve resilience

| Kontrol | Durum | Kanıt |
| --- | --- | --- |
| Aggregate metrics export | NOT_RUN |  |
| Export PII/secret scan | NOT_RUN |  |
| Daily health checklist | NOT_RUN |  |
| 15-user 60-minute soak | NOT_RUN |  |
| Concurrent support/campaign | NOT_RUN |  |
| Network recovery/stale state | NOT_RUN |  |
| 5xx/429 review route | NOT_RUN |  |
| Rollback measured | NOT_RUN |  |

**Gate:** Metrics export, health, concurrent integrity ve rollback PASS; load limitations open risk olarak yazılabilir.

## 11. İnsan kullanılabilirlik/eğlence gate’i

Closed beta erişimi açılmadan önce Faz A protokolü küçük staging pilotuyla çalıştırılabilir; geniş 8–15 cohort sonucu kapalı beta final değerlendirmesinde kullanılır.

| Ölçüm | Sonuç | Eşik | Durum |
| --- | ---: | ---: | --- |
| Province + role + first action ≤3 dk |  | ≥%80 | NOT_RUN |
| Front eligibility explanation |  | ≥%90 | NOT_RUN |
| Campaign loop comprehension |  | ≥%80 | NOT_RUN |
| Role effect comprehension |  | ≥%75 | NOT_RUN |
| Replay comprehension |  | ≥%75 | NOT_RUN |
| Share discovery |  | ≥%80 | NOT_RUN |
| Map ownership comprehension |  | ≥%85 | NOT_RUN |
| Next action comprehension |  | ≥%80 | NOT_RUN |
| Visual quality |  | hedef ≥4/5 | NOT_RUN |
| Fairness trust |  | hedef ≥4/5 | NOT_RUN |
| Payment/property misconception |  | 0 | NOT_RUN |
| Critical accessibility blocker |  | 0 | NOT_RUN |

**Public gate:** Tüm core thresholds PASS olmadan public erişim açılamaz.

## 12. Open risk register

| Risk | Severity | Probability | Mitigation | Owner | Expiry |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

P0/P1 risk owner ve mitigation olmadan GO verilemez.

## 13. Decision matrix

### Owner-only staging GO

Gerekli:

- release identity;
- D1 integrity;
- automated gates;
- no payment;
- privacy/support minimum;
- rollback.

### 8–15 kişi closed beta GO

Gerekli:

- owner-only staging smoke;
- P0 gameplay/visual semantics;
- participant operation;
- moderator/on-call;
- cohort plan;
- metrics;
- no P0/P1 pilot blocker.

### Free public beta GO

Bu checklist tek başına yeterli değildir. Human thresholds, capacity, public privacy/DSA operation, wider moderation, legal review ve incident readiness gerekir.

### Live money GO

Bu checklist kapsamı dışındadır ve otomatik olarak NO-GO’dur.

## 14. Final karar

```text
Release version:
Release SHA:
Deployment:
D1 backup checksum:
Decision date:

[ ] OWNER-ONLY STAGING GO
[ ] CLOSED BETA GO
[ ] CONDITIONAL GO
[ ] NO-GO

Conditions / blockers:

Release owner — name/date/signature:
Engineering owner — name/date/signature:
QA owner — name/date/signature:
Privacy owner — name/date/signature:
Moderation/operations owner — name/date/signature:
```

## 15. Değişmez kurallar

Aşağıdaki durumda karar otomatik NO-GO’dur:

- farklı SHA’da test ve deployment;
- yedeksiz D1 değişikliği;
- fresh season’ın day 1 olmaması;
- harita sahiplik semantiğinin yanıltıcı kalması;
- gerçek ödeme veya live Stripe capability;
- auth/privacy leak;
- destructive balance/ownership bug;
- ödeme/yatırım/mülkiyet yanılgısı;
- critical accessibility blocker;
- moderator/support/privacy owner bulunmaması.
