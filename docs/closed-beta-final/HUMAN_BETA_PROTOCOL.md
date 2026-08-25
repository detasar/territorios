# Territorios — Human Closed Beta Protocol

## 1. Amaç

Otomatik testlerin kanıtlayamadığı dört soruyu gerçek katılımcılarla yanıtla:

1. İlk kez gelen kişi oyunun ne olduğunu ve sıradaki eylemini anlayabiliyor mu?
2. Harita sahipliği, cephe uygunluğu, rol ve campaign fazları doğru okunuyor mu?
3. Ücretsiz katkı eğlenceli, etkili ve adil hissediliyor mu?
4. Ürün herhangi bir ödeme, yatırım, gerçek province sahipliği veya politik yetki yanılgısı yaratıyor mu?

Bu protokol iki fazdan oluşur:

- **Faz A:** 60 dakikalık moderasyonlu kullanılabilirlik/oynanabilirlik oturumu.
- **Faz B:** 7 günlük doğal closed-beta kullanımı.

## 2. Entry gate

Katılımcı davetinden önce:

- candidate SHA/tag dondurulmuş;
- owner-only staging güncel D1 ile doğrulanmış;
- day 1 sezonu başlamış;
- P0 visual/gameplay backlog kapalı;
- gerçek para ve Stripe secrets yok;
- controller/privacy/support bilgileri görünür;
- moderator/on-call ve report SLA aktif;
- rollback rehearsal geçmiş;
- participant consent metni hazır

olmalıdır.

## 3. Katılımcı profili

Toplam: **8–15 yetişkin**.

Minimum dağılım:

- en az 4 mobile session, 390–430 px;
- en az 2 keyboard-only session;
- en az 1 screen-reader smoke session mümkünse;
- Spanish primary kullanıcılar;
- en az 2 English UI session;
- strategy game deneyimli ve deneyimsiz karışımı;
- ürün ekibinden olmayan, build’i daha önce görmemiş çoğunluk.

Hariç tut:

- 18 yaş altı;
- gerçek kart/ödeme bekleyen kişi;
- test amacıyla gerçek politik propaganda üretmek isteyen kişi;
- rıza vermeyen kişi.

## 4. Province/cohort yerleşimi

8–15 kişiyi 52 fraksiyona serbestçe dağıtmak sosyal testi geçersiz kılar. Beta için 4–6 odak province seç.

Örnek yapı:

| Küme | Taraf A | Taraf B | Hedef kişi |
| --- | --- | --- | ---: |
| Cephe 1 | Madrid | Toledo | 4–6 |
| Cephe 2 | Valencia | Alicante veya Castellón | 4–6 |
| Yedek/spectator | Sevilla/Málaga veya Barcelona/Tarragona | karşı taraf | 2–3 |

Gerçek beta seed’inde aktif olan rotalara göre bu örnek güncellenir. Katılımcıya province dayatmak yerine “bu testte sosyal etkileşimi görebilmek için önerilen yoğun bölgeler” sunulur. Gerçek ikamet, milliyet, siyasi görüş veya konum doğrulanmaz.

Her ana fraksiyonda mümkünse:

- bir attacker/defender katkıcısı;
- bir başka oyuncu;
- en az bir council/announcement akışı

bulunmalıdır.

## 5. Veri minimizasyonu ve rıza

Her katılımcıya random ID ver: `P01`…`P15`.

Kaydetme:

- tamamlandı/tamamlanmadı;
- görev süresi;
- yanlış dönüş sayısı;
- yardım gereksinimi;
- controlled problem code;
- 1–5 survey cevapları;
- izin verilmişse ekran/ses kaydı referansı.

Kaydetmeme:

- isim;
- e-posta;
- ChatGPT user ID;
- cookie/session;
- kart bilgisi;
- açık uçlu özel hayat içeriği;
- gerçek siyasi görüş;
- precise location.

Consent form şunları belirtir:

- teknik/oynanabilirlik araştırması;
- hangi verinin toplanacağı;
- kayıt yapılıp yapılmayacağı;
- retention süresi;
- geri çekilme hakkı;
- support/privacy iletişimi;
- gerçek para kullanılmadığı.

## 6. Faz A — Moderasyonlu 60 dakika

### 6.1 Moderatör kuralları

- Görevi hedef olarak oku; kontrolün adını söyleme.
- 90 saniye bloklanmadıkça yardım etme.
- Yardım verirsen türünü kodla: `NAV`, `CONCEPT`, `TECH`, `A11Y`.
- Kullanıcının niyetini yorumlama; gördüğü davranışı kaydet.
- “Bunu nasıl buldun?” yerine “Şu anda ne olduğunu düşünüyorsun?” sor.
- Katılımcıyı harcama veya belirli politik/bölgesel dil kullanmaya yönlendirme.

### 6.2 Oturum akışı

#### Bölüm 0 — Başlangıç, 5 dakika

1. Rızayı doğrula.
2. Cihaz, viewport, input ve UI dilini kaydet.
3. “Bu bir test ortamıdır, gerçek para alınmaz” sınırını oku.
4. Kullanıcıya ana sayfayı aç; ürün açıklaması yapma.

#### Bölüm 1 — İlk kavrayış, 5 dakika

**Görev:** “Ekrana bakarak burada ne olduğunu ve şu anda nerede önemli bir olay bulunduğunu anlat.”

Ölç:

- territory strategy doğru anlaşılmış mı;
- active front bulunmuş mu;
- own/other/target/selected state karışmış mı;
- Crown gerçek siyasi/ekonomik hak sanılmış mı.

#### Bölüm 2 — Province ve rol, 10 dakika

**Görev:** “Bu sezon temsil etmek istediğin bir bölgeyi seç. Sonra sana uygun bir rol seç ve rolün ne yapacağını anlat.”

Ölç:

- province selection time;
- role selection time;
- role effect comprehension;
- önerilen beta province’leri bulunuyor mu;
- yanlış/geri dönüş sayısı.

#### Bölüm 3 — İlk ücretsiz katkı, 10 dakika

**Görev:** “Katılabildiğin bir cephe bul ve ilk ücretsiz katkını yap. Sonra neyin değiştiğini anlat.”

Ölç:

- my front discovery;
- enabled/disabled reason;
- support action;
- +50/old-new/side/next tick/tahmin kavrayışı;
- action trust.

#### Bölüm 4 — Campaign ve governance, 10 dakika

**Görev:** “Bir sonraki saldırı hedefinin nasıl seçildiğini bul. Oylama kapandıktan sonra ne olacağını anlat.”

Ölç:

- council tab discovery;
- representative/target vote farkı;
- planning → mobilization → active → cooldown;
- equal vote/fairness algısı;
- locked state’te yanlış CTA var mı.

#### Bölüm 5 — Replay ve güven, 5 dakika

**Görev:** “Son olaylardan birini oku ve ne olduğunu kendi cümlelerinle anlat. Sonucun doğrulanabilir olduğunu nereden anlarsın?”

Ölç:

- narrative result comprehension;
- integrity detail discovery;
- hash’in ana anlamı engelleyip engellemediği.

#### Bölüm 6 — Share ve safety, 5 dakika

**Görev:** “Seçili province’i bir arkadaşına gönderecek olsan paylaşım seçeneğini bul; gerçekten gönderme. Sonra başka bir oyuncunun sorunlu mesajını nasıl raporlayacağını göster.”

Ölç:

- share discovery;
- deep link expectation;
- report/mute/block ayrımı;
- safety trust.

#### Bölüm 7 — Settings/legal, 5 dakika

**Görev:** “Dili değiştir, savaş bildirim sınırını bul ve bu betada para alınıp alınmadığını doğrula.”

Ölç:

- locale consistency;
- quiet hours/alerts;
- privacy/support/legal discovery;
- payment misconception.

#### Bölüm 8 — Kapanış survey, 5 dakika

1–5 ölçeği:

1. Haritada kimin nereyi kontrol ettiğini anladım.
2. Katılabileceğim cepheyi kolay buldum.
3. İlk katkımın etkisini anladım.
4. Rolümün ne yaptığını anladım.
5. Bir sonraki anlamlı eylemi biliyorum.
6. Oyunun adil olduğuna güvendim.
7. Konsey kararlarının adil göründüğünü düşündüm.
8. Görsel kalite profesyonel hissettirdi.
9. Bir sonraki tick/oylama için geri gelmek isterim.
10. Bu oyunun gerçek para, yatırım veya province mülkiyeti vermediğini anladım.

Açık sorular:

- En eğlenceli an neydi?
- En kafa karıştırıcı an neydi?
- Beklerken geri gelmek için hangi olay yeterli olurdu?
- Haritada ilk değiştireceğin şey ne olurdu?
- Bu oyunu bir arkadaşına tek cümleyle nasıl anlatırsın?

## 7. Faz B — 7 günlük doğal kullanım

### Gün 0

- Onboarding tamamla.
- Province/role seç.
- İlk support ve role action.
- Baseline survey.

### Gün 1–2

- Campaign planning/mobilization gözlemi.
- Council representative/target vote.
- En az bir attacker ve defender katkısı.

### Gün 3–4

- Capture/repel sonrası next cycle.
- Replay ve leaderboard.
- Province share intent.

### Gün 5–6

- Farklı front gözlemi.
- Role action tekrar kullanımı.
- Notification pressure ve return reason check-in.

### Gün 7

- Final survey.
- Retention intent.
- Fairness, visual clarity ve social identity değerlendirmesi.
- Data deletion/retention hatırlatması.

Beta boyunca moderator:

- gerçek gameplay sonucuna müdahale etmez;
- yalnız safety/incident veya teknik P0’da world’ü durdurur;
- günlük report queue ve 5xx/429 dashboard’unu kontrol eder;
- oyuncuya ödeme veya belirli tarafı destekleme çağrısı yapmaz.

## 8. Problem kodları

| Kod | Anlam |
| --- | --- |
| NAV-MAP | Harita/selection navigasyonu |
| SEM-OWNER | Sahiplik rengi/legend karışıklığı |
| SEM-FRONT | Seçili province/active front karışıklığı |
| ACT-SUPPORT | Support CTA/impact anlaşılamadı |
| ACT-ROLE | Rol etkisi anlaşılamadı |
| GOV-FLOW | Campaign/council akışı anlaşılamadı |
| WAIT-FEEDBACK | Bekleme/tick geri bildirimi yetersiz |
| VIS-DENSITY | Bilgi yoğunluğu/hiyerarşi |
| A11Y-KEY | Keyboard blocker |
| A11Y-SR | Screen-reader blocker |
| A11Y-ZOOM | Zoom/reflow blocker |
| TRUST-FAIR | Fairness/pay-to-win endişesi |
| TRUST-PAY | Ödeme/mülkiyet yanılgısı |
| SAFE-MOD | Report/mute/block problemi |
| TECH-ERROR | 4xx/5xx/client/runtime hata |

## 9. Kabul eşikleri

| Ölçüm | PASS |
| --- | ---: |
| Province + role + first action ≤3 dakika, yardımsız | ≥%80 |
| Front enable/disable nedenini doğru açıklama | ≥%90 |
| Campaign loop açıklama | ≥%80 |
| Role effect açıklama | ≥%75 |
| Replay result açıklama | ≥%75 |
| Province share bulma | ≥%80 |
| Map ownership comprehension | ≥%85 |
| “Next meaningful action” doğru cevap | ≥%80 |
| Visual quality ortalaması | hedef ≥4/5; <3,5 review blocker |
| Fairness trust ortalaması | hedef ≥4/5 |
| Payment/investment/property misconception | 0 |
| Critical mobile/keyboard/screen-reader blocker | 0 |
| Destructive/auth/privacy incident | 0 |

Threshold yalnız toplam oranla saklanmamalı. Mobile, keyboard, Spanish/English ve strategy novice segmentleri ayrı raporlanmalıdır. Küçük örneklem nedeniyle oranlar yön gösterir; tek katılımcıdaki P0 güvenlik/yanılgı olayı yine blocker’dır.

## 10. Eğlence ve retention analizi

Faz B sonunda raporla:

- D1 ve D7 return;
- oyuncu başına active day;
- support/role/vote/share katılımı;
- attacker/defender katkı dengesi;
- contribution concentration;
- ilk ve son gün visual/fairness score;
- “geri gelme nedeni” kategorileri;
- zorunluluk/FOMO hissi;
- bölgesel aidiyetin eğlenceye etkisi;
- council fairness ve social presence.

Başarı yalnız yüksek oturum sayısı değildir. Gece alarmı, suçluluk, aşırı harcama isteği veya dışlayıcı bölgesel dil artıyorsa ürün başarısız kabul edilir.

## 11. Stop ve escalation

Anında durdur:

- gerçek ödeme veya kart girişi;
- auth/PII leak;
- duplicate debit/ownership corruption;
- doxxing, threat veya child-safety;
- participant distress;
- core accessibility blocker;
- persistent 5xx/schema mismatch;
- yatırım/mülkiyet yanılgısı ürün diliyle düzelmiyorsa.

Incident kaydı:

- timestamp;
- build SHA;
- participant random ID;
- severity;
- observed state;
- containment;
- data affected;
- rollback decision;
- follow-up owner.

## 12. Sonuç raporu şablonu

```md
# Closed Beta Result

Build SHA:
Participant count:
Device/input/language mix:
Test dates:

## Decision
PASS / CONDITIONAL PASS / FAIL

## Core thresholds
| Metric | Numerator | Denominator | Result | Threshold |

## Fun and trust
| Question | Mean | Median | Range |

## Segment findings
Mobile:
Keyboard:
Spanish:
English:
Strategy novice:

## Top observed problems
1.
2.
3.

## Incidents

## Fixes and re-test evidence

## Open risks

## GO/NO-GO signatures
```

## 13. Katılımcı hızlı rehberi

Katılımcıya yalnız şu kısa metin verilir:

> Territorios, İspanya’nın province’leri üzerinde oynanan asenkron bir takım strateji betasıdır. Bu testte gerçek para alınmaz; province veya unvanlar gerçek mülkiyet ya da siyasi yetki vermez. Bir bölge ve rol seçebilir, uygun cephelere ücretsiz destek gönderebilir, konsey kararlarına katılabilir ve haritadaki sonucu zaman içinde izleyebilirsin. Test sırasında hata veya sorunlu içerik görürsen uygulamadaki report seçeneğini veya verilen support kanalını kullan. Kart, kimlik belgesi, adres ya da özel bilgi paylaşma. İstediğin anda testten ayrılabilir ve verilerinin silinmesini isteyebilirsin.
