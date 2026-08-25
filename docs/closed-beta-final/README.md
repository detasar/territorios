# Territorios — Final Closed Beta Goal Pack

Bu klasör, Territorios’u mevcut teknik betadan **release öncesi, gerçek para içermeyen, 8–15 yetişkin katılımcılı kapalı beta final adayına** götürmek için tek yürütme kaynağıdır.

## Kaynak gerçekliği

- İncelenen kaynak SHA: `91b433224ed8d66f0a26b5b75b8220703d3f7217`
- Mevcut doğrulanmış motor: `combat-2.0.0`
- Mevcut otomatik kanıt: 152 test, 29 D1 tablosu, 19 trigger, 8 başlangıç cephesi, 4/4 Playwright/Axe akışı ve başarılı GitHub release pipeline
- Mevcut yayın: owner-only ChatGPT Sites beta
- Ödeme sınırı: Stripe test-mode entegrasyonu var; kapalı beta final release’inde gerçek ödeme ve canlı Stripe anahtarı yok

Bu paket, eski `v0.1.0` etiketini release kaynağı olarak kabul etmez. Final beta adayı yeni bir sürüm ve tek bir SHA ile dondurulmalıdır.

## Şu anda kapalı beta release’ini bloke eden başlıklar

1. **Release kimliği:** `main`, eski release etiketi ve owner-only deployment aynı sürümü göstermiyor.
2. **D1 geçişi:** güncel şema değiştirilmiş `0000` migration’ına dayanıyor; mevcut remote D1 için güvenli yükseltme veya ayrı temiz beta D1 gerekir.
3. **Sezon başlangıcı:** boş D1’de ilk sezon `now - 11 days` ile başlıyor; final beta gerçek ilk günden başlamalı.
4. **Harita semantiği:** 52 fraksiyon yalnız beş tekrarlanan renk kullanıyor; legend’da veri modelinde gerçek karşılığı olmayan etiketler var.
5. **Kaynak anlamı:** üst çubuktaki “fraksiyon kaynakları” seçili ilin supply değerini gösteriyor; seçili yabancı ilde semantik bozuluyor.
6. **İnsan kanıtı:** otomasyon ve üç oyunculu QA güçlü olsa da 8–15 gerçek katılımcılı kullanılabilirlik ve eğlence kapısı hâlâ çalıştırılmadı.
7. **Operasyon:** controller/support/privacy kimliği, moderasyon SLA’sı, incident sahibi, beta metrik ihracı ve rollback provası tamamlanmalı.

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
