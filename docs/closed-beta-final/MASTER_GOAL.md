# Master Goal — Territorios Final Closed Beta Candidate

## 1. Amaç

Territorios’u `main` dalındaki doğrulanmış deterministik oyun motorunu koruyarak, gerçek para içermeyen, owner-only staging üzerinde çalışan ve 8–15 yetişkin katılımcıyla güvenle test edilebilen **final kapalı beta adayına** dönüştür.

Bu goal yalnız “uygulama açılıyor” sonucunu kabul etmez. Başarı; ilk kez gelen bir oyuncunun oyunu anlaması, il ve rol seçmesi, doğru cepheyi bulması, ilk ücretsiz katkısını yapması, katkısının etkisini görmesi, konsey-kampanya döngüsünü kavraması ve sistemin teknik/operasyonel olarak geri alınabilir biçimde yayımlanmasıdır.

## 2. Başlangıç durumu

Doğrulanmış başlangıç SHA’sı: `91b433224ed8d66f0a26b5b75b8220703d3f7217`.

Başlangıç sürümünde:

- 52 province/autonomous city;
- sekiz benzersiz başlangıç cephesi;
- `combat-2.0.0` deterministik motor;
- hedef oylaması → 15 dakika mobilizasyon → savaş → cooldown → yeni kampanya döngüsü;
- saatlik tick ve dört capture window;
- 29 uygulama tablosu ve 19 D1 koruma trigger’ı;
- beş koltuklu karma konsey ve yedi günlük rol;
- report, mute, block ve sabit mesaj sözlüğü;
- 15 saniyelik world, 30 saniyelik community polling;
- province deep link ve paylaşım akışı;
- Stripe test-mode/fail-closed ödeme altyapısı;
- 152 test ve yeşil CI release zinciri

vardır.

Bu güçlü teknik taban, kapalı beta release’inin tamamlandığı anlamına gelmez. İnsan kullanılabilirlik kapısı, güvenli D1 rollout’u, sürüm kimliği, harita sahiplik semantiği ve beta operasyonu tamamlanmalıdır.

## 3. Temel ürün ilkeleri

1. **Harita ana üründür.** Oyuncu ilk bakışta neyin kendisine ait olduğunu, nerede savaş olduğunu ve sıradaki anlamlı eylemini görmelidir.
2. **Sunucu otoritatiftir.** Tarayıcı; bakiye, rol, sahiplik, fiyat, savaş sonucu veya ödeme durumu için kaynak değildir.
3. **Eylem anlaşılır olmalıdır.** Kullanıcı bir kontrolü ancak sunucu kabul edebilecekse görmeli; reddedilecek eylem etkin CTA gibi sunulmamalıdır.
4. **Katkı görünür olmalıdır.** Her ücretsiz veya sandbox katkı, gecikmeden önce kendi delta’sını; sonra authoritative sonucu göstermelidir.
5. **Para sonucu satın almamalıdır.** Mevcut %20 paid-power sınırı, transfer/cash-out/loot-box yasağı ve deterministik sonuç korunmalıdır.
6. **Rekabet kişi veya gruplara gerçek dünya düşmanlığı üretmemelidir.** Serbest chat, link, dosya ve politik propaganda MVP dışında kalır.
7. **Kapalı beta bir öğrenme sistemidir.** İnsan kanıtı olmadan retention, monetizasyon veya kapsam büyütülmez.
8. **Her release geri alınabilir olmalıdır.** D1 yedeği, migration provası, immutable SHA, smoke kanıtı ve rollback kararı zorunludur.

## 4. Release kapsamı

### 4.1 Release kimliği ve dondurma

- Yeni sürüm adı: `v0.2.0-beta.1`.
- `package.json`, release notları, deployment metadata ve test raporları aynı sürümü göstermeli.
- Release adayı tek bir immutable commit SHA ile dondurulmalı.
- Eski `v0.1.0` etiketi final adaya taşınmamalı veya yeniden yazılmamalı.
- Deployment sonrası doğrulanan SHA UI’de veya operatör health çıktısında erişilebilir olmalı.

### 4.2 D1 ve sezon başlangıcı

- Boş bir beta D1’de ilk sezon gerçek `now` anından başlamalı.
- `now - 11 days` demo davranışı yalnız test fixture/seed seçeneği olarak kalmalı.
- Varsayılan ve önerilen rollout: mevcut owner-only D1’i export et, ayrı temiz beta D1 oluştur, güncel şemayı sıfırdan uygula, eski D1’i rollback için sakla.
- Veri korunacaksa değiştirilmiş `0000` dosyasına güvenilmez; gerçek `0001` migration’ı oluşturulur ve disposable eski-schema kopyasında prova edilir.
- Migration sonrası 29 tablo, 19 trigger, foreign-key ve integrity kontrolü geçmelidir.
- World bootstrap yalnız bir kez çalışmalı; eşzamanlı ilk istekler çift sezon veya çift cephe oluşturmamalıdır.

### 4.3 İlk oturum ve onboarding

İlk oturumda kullanıcıya aynı anda tüm sistemi öğretme. Progressive disclosure kullan:

1. İl seç.
2. Rol seç; seçmeden önce rolün gerçek sayısal etkisini göster.
3. “Benim cephem” olarak önerilen uygun cepheyi aç.
4. İlk ücretsiz 50 takviyeyi gönder.
5. Delta ve bir sonraki authoritative tick zamanını gör.
6. Ardından konsey, replay, paylaşım ve ayarlar açılır.

Kabul kriteri: ilk kez gelen yetişkinlerin en az %80’i province + role + first free action görevini üç dakika içinde yardımsız tamamlayabilmelidir.

### 4.4 Eylem geri bildirimi

Takviye sonrası yalnız toast/metin gösterme. Aynı kartta:

- `+50` katkı;
- önceki ve yeni raw güç;
- oyuncunun saldıran mı savunan mı olduğu;
- paid share ve %20 cap durumu;
- sıradaki tick zamanı;
- mümkünse “tahmini etki” aralığı

gösterilmeli.

Tahmini etki kesin sonuç gibi sunulmamalı, istemci authoritative motorun yerine geçmemeli ve gerçek tick sonrası tahmin otomatik olarak sonuçla değiştirilmelidir. `prefers-reduced-motion` kullanıcılarında animasyon yerine metin delta’sı yeterlidir.

### 4.5 Cephe seçimi ve düşük kullanıcı yoğunluğu

Sekiz aktif cephe tek düz listede bırakılmamalı:

- önce `Benim cephelerim`;
- sonra `Diğer cepheler`;
- oyuncunun katılabildiği ilk cephe varsayılan;
- desteklenemeyen cephede açık neden;
- haritada saldırı origin/target işaretleri;
- seçili province ile seçili battle ayrı state’ler

olmalıdır.

Kapalı beta katılımcıları 52 fraksiyona rastgele dağılmamalı. En az iki karşılıklı cepheyi sosyal olarak canlı tutacak 4–6 odak province belirlenmeli. Katılımcıların bir kısmı aynı fraksiyonda bulunmalı ki konsey, temsil, duyuru ve koordinasyon test edilebilsin.

### 4.6 Harita sahiplik semantiği

Mevcut beş rengin 52 fraksiyonda tekrar etmesi, aynı renkli ancak ilişkisiz komşuları tek fraksiyon gibi gösterebilir. Final beta için:

- sahiplik rengi deterministik ve fraksiyona bağlı olmalı;
- komşu fraksiyonlar yeterli görsel ayrım taşımalı;
- aynı fraksiyonun bağlı toprakları ortak dış sınır veya sahiplik konturuyla küme olarak okunmalı;
- aktif attacker origin, target, contested ve selected state renk dışında stroke/pattern/icon ile ayrılmalı;
- `Casa del Mar` ve `Liga Dorada` gibi veri modelinde global karşılığı olmayan legend öğeleri kaldırılmalı;
- legend gerçek durumları anlatmalı: `Tu fraksiyonun`, `Diğer fraksiyon`, `Saldırı kaynağı`, `Hedef/kuşatma`, `Seçili province`;
- color-blind ve grayscale kontrolde kritik anlam kaybolmamalı.

52 tamamen benzersiz rengi kullanıcıya ezberletmek gerekmez. Öncelik, oyuncunun kendi fraksiyonu ve aktif savaş bağlamını kusursuz ayırmasıdır.

### 4.7 Kaynak ve province kartı doğruluğu

- “Fraksiyon kaynakları” etiketi altında rastgele seçili province’in supply değeri gösterilmemeli.
- Seçeneklerden biri seçilmeli: oyuncunun home province supply’si; fraksiyon toplam/uygun supply metriği; ya da etiketi açıkça `Seçili province supply` yapmak.
- Province crest sabit coral olmamalı; gerçek sahiplik ve savaş durumunu yansıtmalı.
- Owner adı, home/occupied durumu, supply, fortification, defense ve active front bağlamı birbirini çelişmeden göstermeli.

### 4.8 Görsel hiyerarşi ve responsive kalite

Hiyerarşi:

1. Harita ve kritik savaş durumu.
2. Seçili province/aktif cephe komuta kartı.
3. Birincil eylem.
4. Konsey, replay, leaderboard, mağaza ve ayarlar.

Zorunlu viewport’lar: 390×844, 768×1024, 1440×900 ve 1920×1080.

Her viewport’ta:

- yatay taşma yok;
- sabit navigasyon içerik örtmüyor;
- 40×40 minimum touch target;
- normal UI metni 12px altına düşmüyor;
- selected/active/contested states okunuyor;
- dialog focus trap, Escape ve focus return çalışıyor;
- 200% browser zoom’da core action kaybolmıyor;
- `prefers-reduced-motion` altında kritik bilgi korunuyor.

### 4.9 Roller, governance ve sezon anlatısı

Her rol seçilmeden önce şunları göstermeli:

- günlük etkisi;
- hangi sistemi değiştirdiği;
- ne zaman yeniden kullanılabileceği;
- o rolün saldırı, savunma veya sosyal katkı ekseni.

Campaign fazları kullanıcı dilinde görünmeli:

`Hedef seçiliyor → 15 dakika mobilizasyon → Saatlik savaş → Sonuç → 1 saat reorganizasyon → Yeni hedef`.

Crown ilerlemesi için en az şu göstergeler bulunmalı:

- fraksiyonun kontrol ettiği territory sayısı;
- lider ile fark;
- sezonun kalan süresi;
- current phase;
- son capture ve sıradaki planning round.

### 4.10 Moderasyon, privacy ve katılımcı güvenliği

Kapalı beta deployment’ında görünür olmalı:

- gerçek operator/controller adı;
- privacy ve support iletişim kanalı;
- veri amaçları ve hukuki dayanak özeti;
- saklama ve silme süresi;
- hesap/veri erişim-silme talep yolu;
- beta katılımcı rızası;
- report SLA’sı ve sorumlu kişi;
- acil read-only/disable planı.

Serbest chat, link, dosya ve private messaging eklenmez. Report/mute/block ve sabit mesaj sözlüğü korunur. Human review olmadan hesap için maddi veya uzun süreli yaptırım uygulanmaz.

### 4.11 Beta gözlemlenebilirliği

Üçüncü taraf reklam/izleme SDK’sı eklemeden, mümkün olduğunca mevcut append-only event verisinden anonim/aggregate beta raporu üret:

- invited, signed-in, joined;
- time-to-province, time-to-role, time-to-first-action;
- eligible-front comprehension;
- support attempts/success/rejection;
- role action, representative vote, target vote;
- share intent;
- D1 ve D7 return;
- battle participation ve contribution distribution;
- report/mute/block;
- 4xx, 429, 5xx ve client error;
- task completion ve survey skorları.

Ham raporda e-posta, isim, ChatGPT ID, cookie veya serbest kişisel içerik bulunmamalı. Katılımcı raporları rastgele participant ID ile tutulmalıdır.

### 4.12 Deployment ve rollback

- Son kod önce owner-only staging’de yeni/yükseltilmiş D1’e deploy edilir.
- Migration ve app aynı release SHA’sına bağlıdır.
- Önce database backup, sonra deploy.
- Post-deploy smoke tamamlanmadan paylaşım politikası değişmez.
- Rollback tetikleri: schema mismatch, duplicate season/front, auth leak, destructive balance bug, 5xx spike, inaccessible core action, privacy metni eksikliği veya P0/P1 insan testi bulgusu.
- Eski artifact ve D1 export saklanır; rollback provası belge üzerinde değil fiilen staging’de doğrulanır.

## 5. Kapsam dışı

Final kapalı beta release’inde şunlar yapılmaz:

- canlı Stripe anahtarı veya gerçek kart;
- public marketing/influencer launch;
- serbest chat veya DM;
- kullanıcılar arası varlık transferi;
- cash-out, NFT, token, ödül veya loot box;
- ilçeler/belediyeler katmanı;
- karmaşık ittifak ekonomisi;
- native mobil uygulama;
- kanıtsız retention dark pattern’ları;
- gerçek dünya siyasi propaganda veya bölgesel nefret mekanikleri.

## 6. Yürütme fazları

### Faz A — Freeze ve release safety

- release branch/SHA;
- season start fix;
- D1 stratejisi;
- version/tag alignment;
- operator/privacy/support minimumları.

### Faz B — Oynanabilirlik ve görsel doğruluk

- map ownership semantics;
- legend;
- resource semantics;
- front grouping/default;
- first-action impact feedback;
- role/campaign/Crown anlatısı;
- responsive polish.

### Faz C — Otomatik doğrulama

- unit/component/API;
- migration/campaign/runtime/bootstrap;
- Playwright/Axe;
- visual regression;
- security and privacy smoke;
- beta metrics export rehearsal.

### Faz D — Owner-only staging

- backup;
- deploy;
- post-deploy smoke;
- rollback rehearsal;
- access allowlist.

### Faz E — İnsan kapalı beta

- 60 dakikalık moderasyonlu oturumlar;
- 7 günlük doğal kullanım;
- threshold analizi;
- P0/P1 düzeltme ve re-test;
- GO/NO-GO.

## 7. Definition of Ready

Bir görev uygulamaya alınmadan önce:

- owner ve beklenen kanıt belli;
- doğru environment belli;
- PII/ödeme etkisi açıklanmış;
- success/failure kriteri ölçülebilir;
- migration veya schema etkisi varsa rollback yolu tanımlı;
- UI görevi için desktop/mobile state hedefi var.

## 8. Definition of Done

Final closed beta candidate tamamlanmış sayılır yalnızca:

1. P0 backlog sıfırdır.
2. Release SHA, version, migration ve deployment eşleşir.
3. İlk sezon doğru gün 1’den başlar.
4. 29 tablo/19 trigger ve D1 integrity doğrulanır.
5. Harita sahiplik/legend/resource semantiği testte doğru anlaşılır.
6. İlk ücretsiz eylem ve etkisi görünürdür.
7. Bütün otomatik kapılar aynı SHA’da yeşildir.
8. Owner-only staging smoke ve rollback provası geçmiştir.
9. 8–15 gerçek katılımcılı core task eşikleri geçmiştir.
10. Payment/property yanılgısı sıfırdır.
11. Privacy, support ve moderation operasyonu aktiftir.
12. GO/NO-GO checklist yetkili kişilerce imzalanmıştır.

## 9. Zorunlu teslimler

- release commit ve tag;
- D1 backup/export ve migration kanıtı;
- güncel desktop/tablet/mobile screenshots;
- öncesi/sonrası görsel karşılaştırma;
- test ve CI kanıtı;
- beta metrics aggregate raporu;
- insan testi raporu;
- açık risk register’ı;
- katılımcı rehberi;
- incident/moderation iletişim planı;
- rollback kanıtı;
- imzalı GO/NO-GO kararı.
