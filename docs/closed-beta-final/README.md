# Territorios — Final Closed Beta Goal Pack

Bu klasör, Territorios’u mevcut teknik betadan **release öncesi, gerçek para içermeyen, 8–15 yetişkin katılımcılı kapalı beta final adayına** götürmek için tek yürütme kaynağıdır.

## Kaynak gerçekliği

- Release adayı: `v0.2.0-beta.1`; authoritative SHA, immutable tag ve Sites deployment kaydında aynı olmalıdır.
- Doğrulanmış motor: `combat-2.0.0`.
- Güncel otomatik kanıt: 186 test, coverage eşiği, 29 D1 tablosu, 19 trigger, 52 territory, 8 başlangıç cephesi, 4/4 Playwright/Axe akışı ve day-one concurrent bootstrap.
- Rollout: önceki owner-only site/D1 değişmeden rollback noktası olarak saklanır; final aday ayrı ve temiz owner-only Sites/D1 projesine gider.
- Ödeme sınırı: mağaza yoktur; payment snapshot/checkout/control/webhook uçları fail-closed `404` döner; deployment’ta Stripe anahtarı yoktur.

Bu paket, eski `v0.1.0` etiketini release kaynağı olarak kabul etmez. Final beta adayı yeni bir sürüm ve tek bir SHA ile dondurulmalıdır.

## Kalan dış kapılar

1. **İnsan kanıtı:** 8–15 gerçek yetişkinle 60 dakikalık moderasyonlu oturum ve D7 kullanımı `NOT_RUN`.
2. **İmza:** release, QA, privacy ve moderation owner imzaları insan tarafından tamamlanmalı.
3. **Paylaşım:** owner-only erişim bu iki kapı geçmeden katılımcı veya public erişime çevrilmez.
4. **Hukuk:** canlı para ayrı release’tir ve bu aday için otomatik `NO-GO`dur.

## Belge seti

| Belge | Kullanım amacı |
| --- | --- |
| [MASTER_GOAL.md](MASTER_GOAL.md) | Yetkili kapsam, iş akışları, non-goals ve Definition of Done |
| [GOAL_4000_TR.md](GOAL_4000_TR.md) | Uygulayıcı ajana verilecek tam 4.000 karakterlik Türkçe goal metni |
| [PLAYABILITY_AND_VISUAL_AUDIT.md](PLAYABILITY_AND_VISUAL_AUDIT.md) | Oynanabilirlik ve görsel hiyerarşi denetimi |
| [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md) | Sıralı P0/P1/P2 görevleri ve kabul kriterleri |
| [ACCEPTANCE_TEST_MATRIX.md](ACCEPTANCE_TEST_MATRIX.md) | Otomatik ve manuel release test matrisi |
| [HUMAN_BETA_PROTOCOL.md](HUMAN_BETA_PROTOCOL.md) | 8–15 kişiyle moderasyonlu ve 7 günlük gerçek kullanım protokolü |
| [RELEASE_RUNBOOK.md](RELEASE_RUNBOOK.md) | D1, deploy, smoke, paylaşım ve rollback adımları |
| [GO_NO_GO_CHECKLIST.md](GO_NO_GO_CHECKLIST.md) | Final karar ve imza tablosu |
| [PARTICIPANT_GUIDE.md](PARTICIPANT_GUIDE.md) | Katılımcının ilk üç dakikası, harita, campaign ve destek yolu |
| [RELEASE_NOTES_v0.2.0-beta.1.md](RELEASE_NOTES_v0.2.0-beta.1.md) | GitHub ön sürüm notu, yerel kurulum ve kanıt özeti |
| [COHORT_ALLOCATION.md](COHORT_ALLOCATION.md) | PII içermeyen P01–P15 odak-province dağılımı |
| [OPERATIONS_AND_MODERATION.md](OPERATIONS_AND_MODERATION.md) | SLA, privacy, moderation, incident ve rollback sorumlulukları |
| [METRICS_DICTIONARY.md](METRICS_DICTIONARY.md) | İçeriksiz aggregate beta metrik sözlüğü |

## Yürütme sırası

1. `MASTER_GOAL.md` ile scope freeze yap.
2. `IMPLEMENTATION_BACKLOG.md` içindeki P0 görevlerini sırayla kapat.
3. Görsel ve oynanabilirlik değişikliklerini `PLAYABILITY_AND_VISUAL_AUDIT.md` kabul kriterlerine göre uygula.
4. Bütün otomatik kapıları `ACCEPTANCE_TEST_MATRIX.md` ile geçir.
5. Owner-only staging’i `RELEASE_RUNBOOK.md` ile yeni/uygun yükseltilmiş D1 üzerinde kur.
6. `HUMAN_BETA_PROTOCOL.md` ile gerçek katılımcı testini yürüt.
7. Başarısız eşikleri düzeltip yeniden test et.
8. `GO_NO_GO_CHECKLIST.md` imzalanmadan erişimi 8–15 kişiye açma.

## Zorunlu komut zinciri

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

Tüm komutlar aynı release SHA’sında yeşil olmalıdır. Yerel test sonucu, farklı bir commit’in deployment kanıtı olarak kullanılamaz.

## Release seviyeleri

- **Owner-only staging:** teknik kurulum ve smoke için uygundur.
- **Closed beta:** bu paketteki P0’lar kapalı, staging doğrulanmış ve katılımcı operasyonu hazırsa açılabilir.
- **Ücretsiz public beta:** insan kabul eşikleri geçmeden açılamaz.
- **Canlı para:** bu paket kapsamında değildir; hukuk, vergi, tüketici, yaş, fraud, destek ve ödeme sağlayıcısı kapıları için ayrı release gerekir.
