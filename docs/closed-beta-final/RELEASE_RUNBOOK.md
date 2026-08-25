# Territorios — Final Closed Beta Release Runbook

## 1. Amaç ve sınır

Bu runbook, final candidate’ı **owner-only staging’den 8–15 kişilik gerçek para içermeyen kapalı beta erişimine** güvenli biçimde taşır.

Bu runbook şunları yapmaz:

- canlı Stripe açmaz;
- public erişim açmaz;
- existing production D1’i yedeksiz değiştirmez;
- eski `v0.1.0` release’ini yeniden etiketlemez;
- human beta sonucu çıkmadan public GO vermez.

## 2. Roller

| Rol | Sorumluluk | Ad/iletişim |
| --- | --- | --- |
| Release owner | Son karar, freeze, sharing | Davut Emre — in-app fixed request route |
| Engineering owner | Kod/schema/test | Davut Emre — GitHub repository |
| D1/operations owner | Backup, binding, restore | Davut Emre — Sites owner console |
| Product/UX owner | Task/human thresholds | Davut Emre — beta operations queue |
| Privacy contact | Notice, rights requests | Davut Emre — in-app `privacy-access` / `privacy-delete` |
| Moderator/on-call | Reports/incidents | Davut Emre — in-app moderation/security queue |
| QA owner | Evidence manifest | Davut Emre — release checklist |

Bu atamalar uygulama ve runbook üzerinde tek sorumlu olarak yayınlanır; katılımcı davetinden önce insan imzası ve izlenen queue doğrulaması gerekir.

## 3. Environment’lar

| Environment | Amaç | D1 | Erişim | Stripe |
| --- | --- | --- | --- | --- |
| Local | geliştirme/unit/E2E | local disposable | developer | optional test secrets, yalnız local |
| Staging owner-only | final deploy/smoke | ayrı beta D1 | owner | secrets yok |
| Closed beta | 8–15 participant | aynı doğrulanmış beta D1 | allowlist/invite | secrets yok |
| Public/live | kapsam dışı | ayrı karar | kapalı | kapalı |

Staging ve closed beta aynı artifact/SHA üzerinde olmalıdır. Sharing policy değişikliği yeni build yaratmamalıdır.

## 4. Phase 0 — Scope ve source freeze

- [ ] `main` temiz ve beklenen SHA’da.
- [ ] P0 backlog kapalı.
- [ ] `package.json` version `0.2.0-beta.1`.
- [ ] First-season start bug düzeltildi.
- [ ] Harita colors/legend/resource semantics düzeltildi.
- [ ] Operator/privacy/support minimumları hazır.
- [ ] Real Stripe/payment kapalı.
- [ ] Candidate branch protection/merge kararı verildi.

Freeze komutları örneği:

```bash
git checkout main
git pull --ff-only
git status --short
git rev-parse HEAD
npm ci
```

Kaydet:

```text
RELEASE_VERSION=v0.2.0-beta.1
RELEASE_SHA=<40-char SHA>
RELEASE_DATE=<ISO-8601>
```

## 5. Phase 1 — Database kararı

### 5.1 Tercih edilen yol: temiz closed-beta D1

Bu yol, owner-only eski beta verisinin korunması zorunlu değilse seçilir.

1. Mevcut D1’i export et.
2. Export için checksum üret.
3. Export’u private ve erişimi sınırlı yerde sakla.
4. Ayrı bir closed-beta D1 oluştur/resetle.
5. Güncel migration’ları boş D1’e uygula.
6. 29 table, 19 trigger, foreign-key ve integrity doğrula.
7. Candidate staging’i yeni D1 binding’e bağla.
8. Eski D1 binding bilgisini rollback manifest’ine yaz.

Repo-local prova:

```bash
npm run verify:migration
npm run verify:bootstrap
npm run verify:runtime
npm run verify:campaign
```

Production/Sites D1 işlemi platformun gerçek binding ve backup mekanizmasıyla yapılır. Local `--persist-to` çıktısı remote backup sayılmaz.

### 5.2 Veri korunacaksa: gerçek upgrade migration

- [ ] Old release schema’dan disposable DB üret.
- [ ] `0001_campaign_loop_upgrade.sql` oluştur.
- [ ] Table rebuild gerekiyorsa copy/rename/drop adımlarını açık yaz.
- [ ] Council ballots’ı governance round’a bağla.
- [ ] Council seats’i term’e bağla.
- [ ] Campaign rounds ve battle campaign linklerini oluştur.
- [ ] Existing history/audit append-only kalsın.
- [ ] Forward migration iki kez çalıştırıldığında güvenli davranış göster.
- [ ] Rollback veya restore-from-export provası yap.

**NO-GO:** Remote D1’in değiştirilmiş ve daha önce uygulanmış `0000` içeriğini otomatik yeniden çalıştıracağı varsayımı.

## 6. Phase 2 — Full local release gates

Temiz clone veya clean worktree kullan:

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

Kanıt kaydet:

- command;
- start/end time;
- exit code;
- RELEASE_SHA;
- test count/coverage;
- 52 territories;
- 8 unique fronts;
- `combat-2.0.0`;
- 29 tables/19 triggers;
- browser/Axe results.

Failure varsa aynı candidate tag’i oluşturma. Fix sonrası yeni SHA ve bütün zinciri baştan çalıştır.

## 7. Phase 3 — Visual evidence

Aynı SHA ve deterministic seed ile:

- 1440×900 anonymous;
- attacker;
- defender;
- council planning;
- mobilizing;
- capture/replay;
- 768×1024;
- 390×844 onboarding;
- 390×844 active action;
- open dialog/moderation;
- 200% zoom;
- grayscale/color-vision simulation

screenshots üret.

Manifest örneği:

```json
{
  "file": "390-attacker-support.png",
  "sha": "<RELEASE_SHA>",
  "viewport": "390x844",
  "locale": "es",
  "identity": "P-SEED-ATTACKER",
  "worldSeed": "closed-beta-v1",
  "state": "joined-attacker-before-first-support"
}
```

QA owner her görüntüyü açıp loading/blank/crop/wrong state olmadığını kabul eder.

## 8. Phase 4 — Tag ve release candidate

Bütün local gates geçtikten sonra:

```bash
git tag -a v0.2.0-beta.1 <RELEASE_SHA> -m "Territorios closed beta candidate v0.2.0-beta.1"
git push origin v0.2.0-beta.1
```

Release notunda:

- closed beta;
- no real money;
- data/schema version;
- P0 fixes;
- test evidence;
- known limitations;
- rollback artifact;
- human gate `NOT_RUN`

belirtilir.

## 9. Phase 5 — Owner-only staging deploy

1. Candidate artifact’ı deploy et.
2. Beta D1 binding’i doğrula.
3. Stripe env/secrets olmadığını doğrula.
4. Sharing owner-only kalsın.
5. Deployment SHA ve version’ı kaydet.
6. Cache/no-store ve security headers kontrol et.

Deploy sırasında D1/app farklı version’da kalabilecek bir pencere varsa maintenance/read-only state kullan.

## 10. Phase 6 — Deployed staging smoke

### 10.1 Anonymous

- [ ] `/` 200 ve map render.
- [ ] `/api/game` `live-world`, 52 territory, 8 unique front.
- [ ] `viewer === null`.
- [ ] `/api/community` private viewer data yok.
- [ ] Province deep link + OG metadata.
- [ ] No PII/internal payload leak.
- [ ] `Cache-Control: private, no-store`.
- [ ] CSP/nosniff/referrer/permissions headers.

### 10.2 Authenticated participant seed

- [ ] Sign-in and safe return.
- [ ] Join focus province + role.
- [ ] Day 1 and 300 free support.
- [ ] My front default.
- [ ] Send 50; impact feedback.
- [ ] Second user polling sync.
- [ ] Role action.
- [ ] Representative ballot.
- [ ] Planning-only target ballot.
- [ ] Announcement/vote/report/mute/block.
- [ ] Replay narrative + integrity.
- [ ] Locale ES→EN.
- [ ] Share deep link.
- [ ] Store hidden or explicit no-money/fail-closed.

### 10.3 Data

- [ ] 29 table/19 trigger.
- [ ] Single active season.
- [ ] Eight unique active target.
- [ ] No duplicate ledger/order/event.
- [ ] Error log 0 P0/P1.

## 11. Phase 7 — Rollback rehearsal

Owner-only iken rollback fiilen prova edilir.

### Rollback triggers

- schema mismatch;
- duplicate season/front;
- auth/private data leak;
- balance/ownership corruption;
- persistent 5xx;
- inaccessible core action;
- wrong deployed SHA;
- unintended payment capability;
- P0 privacy/moderation failure.

### Rehearsal

1. Current candidate timestamp/SHA kaydet.
2. Previous artifact’a dön veya staging deployment alias’ını geri al.
3. Previous D1 binding/restore yolunu uygula.
4. Anonymous and authenticated smoke.
5. Recovery time ölç.
6. Candidate’a tekrar dön.
7. D1 integrity ve no lost/duplicate event kontrol et.

Rollback hedefi bu beta için ölçülür ve karar tablosuna yazılır; gerçekçi olmayan SLA vaat edilmez.

## 12. Phase 8 — Participant access preparation

- [ ] 8–15 adult invite list; random participant IDs.
- [ ] 4–6 focus province allocation.
- [ ] Consent and participant guide.
- [ ] Test dates and support hours.
- [ ] Moderator/on-call rota.
- [ ] Report SLA.
- [ ] Metrics export command.
- [ ] Incident form.
- [ ] Daily health checklist.
- [ ] Access revoke procedure.

Invite mesajı:

> Territorios’un sınırlı, gerçek para içermeyen kapalı beta testine davetlisin. Oyun 52 province üzerinde çalışan asenkron bir takım stratejisidir. Bu testte kart veya ödeme kullanılmaz; oyun içi territory ve unvanların gerçek mülkiyet, yatırım ya da siyasi değeri yoktur. Test sırasında yalnız gerekli kullanım ölçümleri random participant ID ile tutulur. Özel bilgi paylaşma; istediğin anda ayrılabilir ve verilerinin silinmesini isteyebilirsin. Destek/Privacy: <CONTACT>.

`<CONTACT>` gerçek ve izlenen kanal olmadan davet gönderilmez.

## 13. Phase 9 — Sharing change

Yalnız şu kapılar geçince:

- staging smoke PASS;
- rollback PASS;
- owners assigned;
- P0 backlog 0;
- privacy/support active;
- beta protocol ready;
- participant list ready;
- Stripe/payment disabled

sharing owner-only’den seçili 8–15 katılımcıya çevrilir.

Sharing değişiminden hemen sonra:

- anonymous/unauthorized behavior;
- invited sign-in;
- first join/support;
- logs;
- D1 counts

yeniden kontrol edilir.

## 14. Daily closed-beta operations

Her gün:

- [ ] `/api/game` health.
- [ ] active season/front count.
- [ ] 5xx/429/client error.
- [ ] duplicate/negative balance guard.
- [ ] report queue/SLA.
- [ ] unusual account creation/support concentration.
- [ ] participant support requests.
- [ ] D1 backup cadence kararı.
- [ ] P0/P1 incident.

World’e sonuç değiştirmek için manuel müdahale yapma. Düzeltme gerekiyorsa incident ve versioned action kaydı üret.

## 15. Beta closeout

7 gün veya stop condition sonunda:

1. Yeni participant erişimini kapat.
2. Aggregate metrics export et.
3. Rıza süresi uyarınca raw session materyalini sakla/sil.
4. D1 backup al.
5. Human threshold raporu üret.
6. Open risk ve incident’ları sınıflandır.
7. Required fix + re-test planı yaz.
8. GO/NO-GO checklist imzala.
9. Public erişim otomatik açma.

## 16. Evidence manifest şablonu

```md
# Release Evidence — v0.2.0-beta.1

Release SHA:
Deployment ID/URL:
D1 database/binding:
D1 backup checksum/location:
Schema: 29 tables / 19 triggers
Engine: combat-2.0.0
Season starts:
Initial fronts:

## Automated gates
- npm audit:
- verify:migration:
- verify:campaign:
- verify:
- verify:runtime:
- verify:bootstrap:
- test:e2e:

## Manual gates
- Visual evidence manifest:
- Accessibility smoke:
- Deployed anonymous/auth smoke:
- Rollback rehearsal:
- Privacy/support/moderation:

## Human gate
NOT_RUN / PASS / FAIL
Report:

## Known risks

## Decision
OWNER-ONLY / CLOSED-BETA-GO / NO-GO
Signatures:
```
