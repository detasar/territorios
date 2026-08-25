# Territorios — Final Closed Beta Acceptance Test Matrix

## 1. Test ilkeleri

- Bütün release kanıtları aynı candidate SHA’da üretilir.
- Disposable/local D1 testleri production kanıtının yerine geçmez; staging smoke ayrıca yapılır.
- Otomatik Axe sonucu manuel erişilebilirlik testinin yerine geçmez.
- Stripe anahtarı olmayan fail-closed store test edilir; gerçek ödeme yapılmaz.
- Test hesapları gerçek kişi e-postası veya özel içerik kullanmaz.
- Bir failure, açıkça `waived` ve owner/imza olmadan görmezden gelinemez.

## 2. Release identity ve schema

| ID | Senaryo | Yöntem | Beklenen | Blocker |
| --- | --- | --- | --- | --- |
| REL-01 | Version/SHA eşleşmesi | UI/health + tag + deployment metadata | `v0.2.0-beta.1` ve aynı SHA | P0 |
| REL-02 | Eski tag korunur | Git tag kontrolü | `v0.1.0` değişmez | P0 |
| DB-01 | Fresh D1 migration | `npm run verify:migration` | 29 table, 19 trigger, integrity/foreign-key OK | P0 |
| DB-02 | Fresh world day | `npm run verify:bootstrap` + API assert | season day 1, yaklaşık 28 gün remaining | P0 |
| DB-03 | Concurrent bootstrap | parallel first requests | tek active season, tek initial world | P0 |
| DB-04 | Eight unique fronts | runtime smoke | 8 active battle, 8 unique target | P0 |
| DB-05 | Upgrade path | disposable old-schema copy | `0001` veya clean-D1 strategy eksiksiz | P0 |
| DB-06 | Backup | D1 export/hash | export okunabilir ve geri yüklenebilir | P0 |
| DB-07 | Rollback rehearsal | staging | eski artifact + D1 geri dönüşü çalışır | P0 |

## 3. Otomatik release zinciri

Aşağıdaki komutların tamamı sıfır exit code ile bitmelidir:

```bash
npm ci
npm audit
npm run verify:migration
npm run verify:campaign
npm run verify
npm run verify:runtime
npm run verify:bootstrap
npm run test:e2e
```

| Kapı | Minimum sonuç |
| --- | --- |
| Dependency audit | 0 known vulnerability |
| Lint | 0 error |
| Typecheck | 0 error |
| Unit/component/API | tüm testler pass |
| Statements | ≥ %85 |
| Branches | ≥ %80 |
| Functions | ≥ %85 |
| Lines | ≥ %85 |
| Campaign harness | ≥5 voted cycle, season close/reset, concurrency pass |
| Runtime smoke | 52 territory, 8 front, `combat-2.0.0` |
| Browser E2E | bütün scenario pass |
| Axe | initial/completed/store/legal state’lerde 0 automated violation |

## 4. Gameplay functional matrix

### 4.1 Kimlik ve katılım

| ID | Durum | Adımlar | Beklenen |
| --- | --- | --- | --- |
| GAME-01 | Anonymous world | `/` aç | Harita görülebilir; mutation CTA sign-in ister |
| GAME-02 | Sign-in return | Province deep link’ten sign-in | Aynı province’e güvenli relative return |
| GAME-03 | Join faction | Province + role seç | Membership, 300 free support, onboarding ilerler |
| GAME-04 | Repeat join idempotency | Aynı command key | Çift welcome grant yok |
| GAME-05 | Faction change first window | İlk 48 saat | Kural uyarınca izin/lock doğru |
| GAME-06 | Council member change | Aktif council seat | Change reddedilir |
| GAME-07 | Battle home change | Province active battle’da | Change reddedilir |

### 4.2 Cephe ve support

| ID | Durum | Beklenen |
| --- | --- | --- |
| FRONT-01 | Joined attacker | `My fronts` ilk sırada; attacker badge; CTA açık |
| FRONT-02 | Joined defender | `My fronts` ilk sırada; defender badge; CTA açık |
| FRONT-03 | Observer front | CTA yok; açık observation reason |
| FRONT-04 | No active front | Wallet korunur; next mobilization state görünür |
| FRONT-05 | Support 50 | Wallet -50; doğru battle side +50; ledger/event tek kayıt |
| FRONT-06 | Double click | Yalnız tek accepted debit/order |
| FRONT-07 | Concurrent attacker/defender | Her iki taraf atomik ve doğru projection |
| FRONT-08 | Front switch | Eski success/error mesajı yeni front’a taşınmaz |
| FRONT-09 | Polling sync | Diğer oyuncu katkısı ≤20 saniyede görünür |
| FRONT-10 | Tick boundary | Authoritative refresh sonrası countdown/result güncel |
| FRONT-11 | Impact feedback | +50, old→new, side, next tick ve projected/queued state görünür |

### 4.3 Campaign loop

| ID | Faz | Beklenen |
| --- | --- | --- |
| CAMP-01 | Planning | Yalnız eligible council target CTA görür |
| CAMP-02 | No council/no vote | Round kontrollü biçimde no-target kapanır ve yenisi açılır |
| CAMP-03 | Target lock | Winner kayıtlı; ballot kapanır; CTA read-only olur |
| CAMP-04 | Mobilizing | 15 dakika state ve target görünür; battle erken başlamaz |
| CAMP-05 | Active | Battle origin/target, context ve engine version doğru |
| CAMP-06 | Capture | Ownership, history, score, campaign cooldown atomik |
| CAMP-07 | Repel | Owner korunur; cooldown ve next origin doğru |
| CAMP-08 | Next cycle | Successful capture sonrası controlled target origin olabilir |
| CAMP-09 | Active target uniqueness | Racing campaigns aynı target’ta iki battle oluşturamaz |
| CAMP-10 | Season close | Winner/Crown sembolik kayıt; active season kapanır |
| CAMP-11 | Season reset | Season 2 tek kez açılır; old history immutable |

### 4.4 Combat fairness

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| COMBAT-01 | Same inputs | Same engine version = same output |
| COMBAT-02 | Paid cap | Effective paid ≤ total power’ın %20’si |
| COMBAT-03 | Queued paid | Fazla paid kaybolmaz; free capacity yoksa etkisiz queue |
| COMBAT-04 | Supply disconnected | Belgelenmiş penalty uygulanır |
| COMBAT-05 | Distance | Route cost modifier uygulanır |
| COMBAT-06 | Overextension | Concurrent front penalty uygulanır |
| COMBAT-07 | Fortification | Defender modifier görünür ve hesapta kullanılır |
| COMBAT-08 | Homeland/occupation | Doğru owner/time state modifier |
| COMBAT-09 | Loss allocation | Free/paid non-negative; total loss bounded |
| COMBAT-10 | Capture window | %100 siege olsa bile yalnız izinli window/min tick ile capture |

### 4.5 Roles ve governance

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| ROLE-01 | Her role selection | Numeric effect ve category görünür |
| ROLE-02 | Daily action | Tek receipt, metric delta, contribution +25 |
| ROLE-03 | Cooldown | İkinci action 429/read-only state |
| ROLE-04 | Scout | Bounded intel band; exact hidden data leak yok |
| GOV-01 | Representative ballot | Equal weight, round scoped, one vote |
| GOV-02 | Council roster | One user one seat; expired term görünmez |
| GOV-03 | Supporter seat | Capped score; yönetim çoğunluğu satın alınamaz |
| GOV-04 | Target ballot | `canVoteTarget` authoritative; planning dışında CTA yok |
| GOV-05 | Tie/runoff | Finalist-only public runoff veya defense state |

## 5. Görsel kabul matrisi

### 5.1 Harita semantiği

| ID | Kontrol | Beklenen | Blocker |
| --- | --- | --- | --- |
| MAP-01 | Owner colors | İlişkisiz komşular tek fraksiyon gibi görünmez | P0 |
| MAP-02 | Same-faction cluster | Bağlı territory’ler ortak owner olarak okunur | P0 |
| MAP-03 | Viewer faction | Renk dışında outline/label ile belirgin | P0 |
| MAP-04 | Origin | Target/selected’dan ayrı stroke/icon | P0 |
| MAP-05 | Target/contested | Pattern ve status label | P0 |
| MAP-06 | Selected province | Owner’dan bağımsız selected state | P0 |
| MAP-07 | Legend | Yalnız gerçek map state’leri; placeholder ad yok | P0 |
| MAP-08 | Grayscale | Own/origin/target/contested/selected ayrılır | P1 |
| MAP-09 | Inset geography | Canary/Ceuta/Melilla okunur ve tıklanır | P1 |
| MAP-10 | Roving keyboard | Arrow/Home/End/Enter/Space çalışır | P0 |

### 5.2 Bilgi ve hiyerarşi

| ID | Kontrol | Beklenen |
| --- | --- | --- |
| UI-01 | Top resource | Label ile gerçek source aynı |
| UI-02 | Province crest | Owner/state token’ı doğru |
| UI-03 | Selected vs battle | İki state açıkça adlandırılmış |
| UI-04 | Primary CTA | Her state’te en fazla bir ana CTA |
| UI-05 | Campaign progress | Phase, next event ve Crown context görünür |
| UI-06 | Replay | Narrative summary first; integrity detail optional |
| UI-07 | Empty state | Next useful action verir |
| UI-08 | Error state | Action-scoped, recovery text ve no stale state |

### 5.3 Viewport ve interaction

| ID | Viewport/state | Beklenen |
| --- | --- | --- |
| RESP-01 | 390×844 onboarding | no overflow; CTA/nav/legend overlap yok |
| RESP-02 | 390×844 active battle | map ve order route okunur |
| RESP-03 | 768×1024 | map dominant; bottom nav içerik örtmez |
| RESP-04 | 1440×900 | map primary, command secondary, hub tertiary |
| RESP-05 | 1920×1080 | excessive empty space veya stretched map yok |
| RESP-06 | 200% zoom | core action ve legal links ulaşılabilir |
| RESP-07 | Touch | interactive targets ≥40×40 |
| RESP-08 | Reduced motion | bilgi kaybı yok; seizure-risk motion yok |

## 6. Accessibility matrix

| ID | Test | Beklenen |
| --- | --- | --- |
| A11Y-01 | Skip link | Klavye ile map’e gider |
| A11Y-02 | Focus order | Görsel ve mantıksal sırayla ilerler |
| A11Y-03 | Dialog | Initial focus, trap, Escape, focus return |
| A11Y-04 | Tabs | Arrow/Home/End ve selected semantics |
| A11Y-05 | Map names | Name, owner, state, defense içerir |
| A11Y-06 | Live updates | Aşırı screen-reader gürültüsü olmadan kritik update |
| A11Y-07 | Contrast | Text/status/disabled/complete onboarding WCAG AA |
| A11Y-08 | Color independence | Critical state yalnız renkle anlatılmaz |
| A11Y-09 | Screen reader | Province select → support → result tamamlanır |
| A11Y-10 | Language | `lang`, labels ve legal document locale tutarlı |

## 7. Community ve moderation matrix

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| MOD-01 | Fixed announcement | Yalnız allowlisted message key |
| MOD-02 | Self vote | Reddedilir |
| MOD-03 | Announcement vote | User başına tek bounded vote |
| MOD-04 | Report | 202/receipt; human-review queue |
| MOD-05 | PII detail | Email/phone-like veri redacted |
| MOD-06 | Drawer state | Report sonrası mute/block erişilebilir kalır |
| MOD-07 | Mute/block privacy | Yalnız viewer projection; public leak yok |
| MOD-08 | Expired/removed content | Feed ve notification consistent |
| MOD-09 | SLA rehearsal | Test report belirlenen süre içinde karara bağlanır |
| MOD-10 | Appeal | Participant kararın yeniden incelenmesini isteyebilir |

## 8. Privacy ve security matrix

| ID | Senaryo | Beklenen | Blocker |
| --- | --- | --- | --- |
| PRIV-01 | Pre-sign-in notice | Controller, purpose, links görünür | P0 |
| PRIV-02 | Rights route | Access/delete request yolu çalışır | P0 |
| PRIV-03 | Retention | Süreler ve deletion job/manual plan tanımlı | P0 |
| PRIV-04 | Beta consent | Consent version ve participant ID kayıtlı | P0 |
| SEC-01 | Anonymous reads | World public; viewer private null |
| SEC-02 | Anonymous mutations | 401/redirect; state değişmez |
| SEC-03 | Spoofed user JSON | User ID request body’den kabul edilmez |
| SEC-04 | Same-origin | Cross-origin mutation reddedilir |
| SEC-05 | Idempotency | Invalid/missing key reddedilir |
| SEC-06 | Rate limit | Bounded 429 ve no partial mutation |
| SEC-07 | Error body | Stack/SQL/secret/PII yok |
| SEC-08 | Headers | CSP/nosniff/referrer/permissions; framing kararı |
| SEC-09 | Secret scan | Repo/log/screenshot’ta secret yok |
| SEC-10 | Audit immutability | Update/delete trigger ile reddedilir |

## 9. Sandbox store matrix

Gerçek para kullanılmaz.

| ID | Senaryo | Beklenen |
| --- | --- | --- |
| PAY-01 | No key | Checkout disabled; free game açık |
| PAY-02 | Live key | Server startup/checkout reddeder |
| PAY-03 | Livemode event | Webhook reddeder |
| PAY-04 | Catalog price | Server D1 source; client amount ignored |
| PAY-05 | Age/consent | Sandbox checkout için zorunlu |
| PAY-06 | Spend limits | Daily ≤ season, only-lower beta rule |
| PAY-07 | Pause | New checkout disabled immediately |
| PAY-08 | Success page | Entitlement vermez; yalnız poll |
| PAY-09 | Signed test webhook | Disposable/local environment only; idempotent grant |
| PAY-10 | Refund/dispute | Compensating entries; historical battles immutable |

Closed beta deployment’ında Stripe secrets eklenmez. PAY-09/PAY-10 yalnız izole test ortamında çalıştırılır.

## 10. Performance ve resilience matrix

| ID | Test | Minimum |
| --- | --- | --- |
| PERF-01 | Initial load | 390/1440’da usable state kabul edilebilir; ölçüm raporlanır |
| PERF-02 | Polling 15 users | 60 dakika; 5xx yok, duplicate event yok |
| PERF-03 | Polling 50/100 simulated | D1 latency/error ve cost raporu; limit kararı |
| PERF-04 | Catch-up 48 tick | Bounded reconciliation, timeout yok |
| PERF-05 | Concurrent support | No lost update/double debit |
| PERF-06 | Concurrent campaign start | Unique target ve atomic garrison debit |
| PERF-07 | Network loss/recovery | Stale indicator; reconnect ile state düzeltir |
| PERF-08 | D1 failure | Friendly no-store error; partial mutation yok |

## 11. İnsan kabul matrisi

| ID | Görev/algı | Eşik |
| --- | --- | ---: |
| HUM-01 | Province + role + first free action ≤3 dk, yardımsız | ≥%80 |
| HUM-02 | Enabled/disabled front nedenini doğru açıklama | ≥%90 |
| HUM-03 | Planning→mobilization→battle→cooldown açıklama | ≥%80 |
| HUM-04 | Role etkisini doğru açıklama | ≥%75 |
| HUM-05 | Replay sonucunu oyuncu diliyle açıklama | ≥%75 |
| HUM-06 | Province share action bulma | ≥%80 |
| HUM-07 | Map ownership comprehension | ≥%85 |
| HUM-08 | Visual quality ortalaması | ≥4/5 hedef, <3,5 blocker review |
| HUM-09 | Fairness trust ortalaması | ≥4/5 hedef |
| HUM-10 | Payment/property misconception | 0 olay |
| HUM-11 | Critical mobile/keyboard/screen-reader blocker | 0 |
| HUM-12 | “Bir sonraki anlamlı eylem nedir?” doğru yanıt | ≥%80 |

## 12. Stop conditions

Test veya beta anında durdurulur:

- balance/ownership/history kaybı;
- auth boundary veya kişisel veri sızıntısı;
- duplicate debit/front/season;
- gerçek ödeme veya yanlışlıkla live Stripe kullanımı;
- katılımcının oyunu yatırım, para ödülü veya gerçek province sahipliği sanması;
- tehdit/doxxing/child-safety incident;
- core action’ın mobile/keyboard/screen reader ile erişilemez olması;
- sürekli 5xx veya rollback gerektiren schema mismatch.

## 13. Evidence manifest

Final karar paketinde:

- candidate SHA/tag;
- CI URL/log;
- D1 export hash;
- migration/runtime/campaign/bootstrap outputs;
- screenshot manifest;
- manual accessibility notes;
- human aggregate results;
- load/soak report;
- moderation rehearsal;
- rollback rehearsal;
- açık waiver/risk ve imzalar

bulunmalıdır.
