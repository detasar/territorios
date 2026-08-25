# Territorios — kapsamlı oynanış, çok oyunculu ve kullanılabilirlik QA raporu

**Tarih:** 25 Ağustos 2026
**Karar:** **KAPALI BETA İÇİN TEKNİK OLARAK HAZIR** — P0/P1 bulunmadı; bu turda açılan P2 ve P3 bulguları düzeltildi ve yeniden doğrulandı. Gerçek insan katılımcılı kapalı beta ayrıca yürütülmelidir.
**Yaklaşım:** Görünür tarayıcı etkileşimi, klavye, gerçek DOM/erişilebilir adlar, üç bağımsız oyuncu kimliği, eşzamanlı komutlar ve otomatik regresyon kapıları.

## 1. Kapsam, ortam ve güven sınırı

- Kaynak çalışma alanı: `/Users/Lenovo1/territorios`.
- Ana tarayıcı önizlemesi: `http://localhost:3020/`, yeni oluşturulmuş yerel D1 durumu.
- Çok oyunculu dünya: ayrı bir geçici D1 durumu ve üç localhost proxy oturumu. Geçici test adaptörü yalnızca `/tmp` altındaki kopyada kullanıldı; kaynak uygulamaya, çalışma ağacına veya yayınlanmış ChatGPT Sites/D1 ortamına yazılmadı.
- Oyuncular: **Alpha** (Madrid, Estratega), **Bravo** (Toledo, Defensor), **Charlie** (Madrid, Heraldo).
- Gerçek finansal checkout, gerçek kart, canlı Stripe anahtarı, üretim deploy ve üretim D1 kapsam dışındadır.

Yerel çoklu-oturum eklentisi, normal Sites geliştirme eklentisinin tek `local_seedy` kimliğine sabit olmasını aşmak için yalnız test kopyasında üç çerez-kimliği verdi. Tüm oyun komutları yine normal HTTP API, aynı-origin koruması ve D1 işlemleri üzerinden, tarayıcı UI’sinden gönderildi.

## 2. Yönetici özeti

Oyunun harita tabanlı ana döngüsü teknik olarak güçlü durumda: 52 il render ediliyor; tarafı olmayan oyuncunun takviye kontrolü doğru biçimde kapalı; eşzamanlı destekler doğru tarafa ve tek cüzdana yazılıyor; ikinci oyuncunun ekranı yeni hamleyi yenileme olmadan 15 saniyelik polling penceresinde görüyor. Topluluk yüzeyi, rol eylemi, duyuru, faydalı oy, rapor, sessize alma, replay, İngilizce arayüz ve ödeme güvenlik duvarları da çalıştı.

Takip düzeltmesinde konsey hedef oyu artık sunucunun ürettiği `canVoteTarget` yetkisine bağlı. Planlama dışındaki aktif/kilitli kampanyada hedef seçici ve CTA render edilmiyor; oyuncu yalnız kilitli hedefi görüyor. Moderasyon ayrıntısının açık durumu da kontrollü React state’ine taşındı ve rapor/panel yeniden oluşturma sonrasında korunuyor.

## 3. Çok oyunculu kanıtlar

| Senaryo | Oyuncular | Sonuç | Gözlenen kanıt |
|---|---|---|---|
| Ayrı kimlik ve katılım | Alpha / Bravo / Charlie | PASS | Üç oturum farklı display name ve rol ile Madrid/Estratega, Toledo/Defensor, Madrid/Heraldo olarak oyuna katıldı. |
| Aynı cephede eşzamanlı destek | Alpha + Bravo | PASS | Başlangıçta saldırı `3500`, Toledo savunması `3000` idi. Aynı anda destekten sonra saldırı `3550`, savunma `3050`; iki cüzdan da `300 → 250` oldu. |
| Hızlı çift tıklama | Bravo | PASS | İki tarayıcı tıklaması tamamlandı; cüzdan yalnız `250 → 200`, Toledo savunması yalnız `3050 → 3100` oldu. İkinci borç/ikinci battle order oluşmadı. |
| Cephe yetki sınırı | Bravo | PASS | Araba/Álava → Burgos seçildiğinde destek düğmesi kayboldu, açıklama `Selecciona un frente en el que participe tu facción.` oldu ve eski başarı mesajı ekranda kalmadı. |
| Polling ile canlı senkron | Charlie → Bravo | PASS | Charlie’nin Madrid → Toledo’ya yeni desteğinden sonra Bravo ekranındaki saldırı gücü yenileme olmadan `3550 → 3600` oldu; ölçüm 16 saniyelik bekleme içinde alındı. |
| Temsilci oyu ve tek oy kilidi | Alpha + Charlie | PASS | Aynı Madrid fraksiyonunda iki oy kaydedildi; Alpha public seat’e yerleşti ve iki oyuncuda da yeniden oy düğmesi kaldırıldı/`Voto registrado` durumuna geçti. |
| Rol eylemi | Charlie | PASS | Heraldo günlük eylemi çalıştı; +25 contribution görünür oldu, başarı mesajı `Acción diaria de rol completada.`, düğme günlük kilide geçti. |
| Duyuru ve oyuncular arası tepki | Alpha → Charlie | PASS | Alpha `Objetivo confirmado` duyurusu yayımladı. Charlie duyuruyu gördü, faydalı oyu `0 → 1` yaptı, raporu insan incelemesine gönderdi (`202`) ve yazarı sessize aldı. |

## 4. Fonksiyonel test matrisi

| Alan | Sonuç | Not |
|---|---|---|
| İlk katılım, il ve rol seçimi | PASS | Üç role ve iki karşı tarafa katılım işlendi. |
| 52 il haritası ve map a11y isimleri | PASS | 52 erişilebilir harita denetimi bulundu; kontrol/savunma/durum bilgisi erişilebilir ada dahil. |
| Harita klavye dolaşımı | PASS | `Home → Araba/Álava`, `ArrowRight → Albacete`, `End → Melilla`. |
| Harita yardım dialogu | PASS | Açılışta odak `Cerrar` düğmesine geçti; `Escape` dialogu kapattı ve odağı yardım tetikleyicisine verdi. |
| Aktif cephe / origin bağlamı | PASS | Seçili il Melilla iken bile emir kartı hedefi açık biçimde `Madrid → Toledo` gösterdi. |
| Replay ve kanıt paneli | PASS | Oyuncu-diliyle kronik var; `Verify integrity` detayının açılmasıyla tam hash görülebiliyor. |
| İspanyolca → İngilizce ayar kaydı | PASS | Arayüz ve durum mesajı İngilizceye geçti; mağaza hukuk linkleri `?lang=en` taşıdı. |
| Sandbox mağaza | PASS | Üç checkout düğmesi test anahtarı yokken disabled; ücretsiz oyun açık. |
| Harcama limiti istemci doğrulaması | PASS | Günlük `160`, sezon `150` iken istek öncesi `Daily limit cannot be higher than the season limit.` gösterildi. |
| Mobil 390×844 | PASS | Yatay taşma yok; üç harita kontrolü `40×40 px`; legenda/alt navigasyon çakışması `0 px`. |
| Tablet 768×1024 | PASS | Harita okunaklı, sabit alt navigasyon içerik üstüne binmiyor. |
| Masaüstü | PASS | Harita ana odak alanını dolduruyor; ana emir kartı rota ve maliyeti açık. |
| Console / ağ taraması (asıl proje kökü) | PASS | Headless Chromium taramasında 4xx/5xx kaynak veya `console.error` gözlenmedi. |

## 5. Bulgular

### P2 — GOV-001: Aktif savaşta kapalı hedef oyu, etkin eylem olarak sunuluyor

**Durum:** DÜZELTİLDİ
**Etkilenen alan:** Konsey / stratejik hedef seçimi
**Etki:** Konsey üyesi oyuncu, uygulanamayacak bir savaş hedefi seçip oylamaya çalışıyor; eylem ancak sonrasında 409 ile reddedildiği için stratejik karar akışına güven azalıyor.

**Yeniden üretim:**

1. Aktif `Madrid → Toledo` kampanyasında konsey üyesi ol.
2. Konsey sekmesini aç.
3. `Objetivo con suministro` altında Guadalajara, Segovia ve Ávila seçeneklerinin bulunduğunu; `Votar objetivo` düğmesinin etkin olduğunu gör.
4. Bir hedef seçip düğmeye bas.

**Gerçekleşen:** UI oyu kabul edilebilir gösterir, fakat API `409 La ronda de objetivo ya está cerrada.` döner. Aynı anda `/api/community` snapshot’ı kampanyayı `phase: "active"`, hedef sonucunu `winner: "45"` / Toledo ve `targetBallotCast: false` olarak döndürür; bu yüzden istemci düğmeyi disabled yapmaz.

**Beklenen:** Hedef zaten kilitliyse hedef seçim alanı hiç render edilmemeli veya read-only “Toledo hedefi kilitlendi; yeni hedef oyu mobilizasyon/planlama turunda açılır” durumuna dönüşmeli. API snapshot’ı, eylemin açık olup olmadığını tek bir otoriter `canVoteTarget` alanıyla vermeli; istemci campaign phase’i türetmemeli.

**Kanıtlanan teknik neden (düzeltme öncesi):** İstemci yalnız `isCouncilMember`, `targetBallotCast` ve `pending` kontrol ediyordu; sunucu ise target oyunu yalnız `campaign.phase === 'planning'` iken kabul ediyor ([community.ts](/Users/Lenovo1/territorios/db/community.ts:574)). Snapshot aktif fazda da `validTargets` listesini yayımlıyor ([community.ts](/Users/Lenovo1/territorios/db/community.ts:330)).

**Uygulanan düzeltme:** `CommunitySnapshot.council.canVoteTarget`, sunucuda kampanya fazı, konsey üyeliği, önceki oy ve geçerli hedef varlığından tek otoriter değer olarak üretiliyor ([community.ts](/Users/Lenovo1/territorios/db/community.ts:290)). İstemci hedef alanını yalnız bu değer doğruysa render ediyor ([community-hub.tsx](/Users/Lenovo1/territorios/src/components/community-hub.tsx:370)).

**Yeniden doğrulama:** Bileşen regresyon testi kilitli/aktif hedefte select ve CTA’nın bulunmadığını doğruladı. İzole D1 kampanya harness’i beş ardışık turda planlama fazında `true`, kilit/mobilizasyon/aktif fazlarda `false` sonucunu doğruladı. Gerçek tarayıcıda Madrid konsey üyesi için `phase=active`, `targetBallotCast=false`, `canVoteTarget=false`; `Votar objetivo` sayısı `0`, “Objetivo elegido: Toledo” sayısı `1` gözlendi.

### P3 — MOD-002: Rapor gönderilince aynı moderasyon çekmecesi kapanıyor

**Durum:** DÜZELTİLDİ
**Etkilenen alan:** Community feed > `Denunciar` ayrıntısı
**Etki:** Bir oyuncu önce rapor, sonra sessize alma/bloklama istiyorsa rapor sonrası güncelleme native `details` çekmecesini kapatıyor. İkinci eylem için `Denunciar`ı yeniden açmak gerekiyor; veri kaybı yok.

**Yeniden üretim:**

1. Başka oyuncunun duyurusunda `Denunciar`ı aç.
2. Sebep seçip `Enviar a revisión humana` ile raporu gönder.
3. Başarı mesajından sonra aynı çekmecedeki `Silenciar autor` veya `Bloquear autor` eylemini kullanmaya çalış.

**Gerçekleşen:** Community snapshot’ı yenilendiği için açık `<details>` yeniden kapalı render edilir. `Silenciar autor` çalışır, ancak oyuncunun çekmeceyi yeniden açması gerekir.

**Beklenen iyileştirme:** Moderasyon komutundan sonra çekmecenin açık durumu korunmalı veya raporun ardından açıkça `Sessize al` / `Engelle` hızlı eylemleri sunulmalı.

**Uygulanan düzeltme:** Açık duyuru kimliği `CommunityHub` state’inde tutuluyor ve `<details open>` kontrollü render ediliyor ([community-hub.tsx](/Users/Lenovo1/territorios/src/components/community-hub.tsx:444)).

**Yeniden doğrulama:** Regresyon testi rapor gönderimi ve konsey panelinin yeniden oluşturulmasından sonra drawer’ın `open` kaldığını, sessize alma/engelleme düğmelerinin görünür olduğunu doğruladı. Geçici D1’de başka yazara ait gerçek duyuru ile tarayıcı testi de `openBeforeReport=true`, `openAfterPanelRecreate=true`, iki hızlı eylem görünür ve başarı mesajı doğru sonucunu verdi; bu açık drawer durumunda Axe WCAG 2.2 AA ihlali `0` idi.

## 6. Oyuncu deneyimi ve keyif değerlendirmesi

### İyi çalışan unsurlar

- Harita ilk bakışta “strateji oyunu” hissi veriyor: 52 il, renk ayrımı, kuşatma deseni ve ada inset’leri okunaklı.
- Ana savaş emri artık yanlış il seçilse bile açık rota gösteriyor; kaynak harcama kararı daha güvenli.
- Saldıran/savunan tarafların aynı cephede eşzamanlı etkisi görünür. Bu, çok oyunculu dünyanın canlı olduğu duygusunu veriyor.
- Replay teknik kayıt ile anlatı arasında iyi bir denge kuruyor: detay isteyen hash’i açıyor, istemeyen oyuncu olayın sonucunu okuyabiliyor.
- Mobilde harita kontrolü, rehber ve alt navigasyon dokunmatik olarak erişilebilir; önceki “klavye kısayolu var ama dokunmatik karşılığı yok” hissi oluşmuyor.

### Sürtünme / öneri (bulgu değil)

- İlk oturumda oyuncunun doğrudan etkilediği ana eylem çoğunlukla `50` takviye ve ardından uzun tick bekleme. Güç sayacı anında güncellense de, ilk dakikadaki taktik anlatı daha güçlü olabilir: örneğin emirden sonra “bu destek bir sonraki hesapta olasılığı/kuşatmayı nasıl etkiler?” kısa ön izlemesi.
- Sekiz aktif cephe tek açılır listede sunuluyor. Harita güçlü olsa da yeni oyuncu için “bu tur benim için önerilen cephe” vurgusu veya yalnız tarafın katıldığı cepheyi varsayılan filtreleme, karar yükünü azaltır.
- Moderasyon, rapor ve sessize alma eylemlerinin aynı drawer’da bulunması doğru; P3 sürtünmesi giderilirse oyuncu güvenliği yüzeyi daha akıcı olur.

## 7. Otomatik kapılar ve ek kanıt

```text
npm run verify
152/152 test; lint, typecheck ve production build PASS
coverage: statements %88,85; branches %80,03; functions %89,39; lines %91,37

npm run verify:campaign
CAMPAIGN_CYCLE_PASS voted_cycles=5 total_captures=6 next_cycle=7 next_season=2

npm run test:e2e
4/4 PASS (izole D1; WCAG 2.2 AA başlangıç/tamamlanmış onboarding,
390 px reflow, dialog focus/Escape, sandbox store, ES/EN legal)

npm run verify:runtime
RUNTIME_SMOKE_PASS territories=52 fronts=8 engine=combat-2.0.0 anonymous_viewer=true

npm run verify:migration
D1_MIGRATION_PASS tables=29 triggers=19 purchase_columns=21 integrity=ok

web_game_playwright_client.js
mapStatus=ready, mapProvinces=52, worldTerritories=52,
communityStatus=ready, engineVersion=combat-2.0.0
```

Oyun otomasyon istemcisinin geçici çoklu-oturum kopyasında görülen Geist font 404’leri ana proje kökünde yeniden üretilmedi: asıl `localhost:3020` önizlemesinde Chromium ağ/console taraması `0` hatayla geçti. Bu nedenle ürün bulgusu sayılmadı.

## 8. Test edilmeyen / kısmi alanlar

- Gerçek Stripe test Checkout Session, webhook veya kart girişi çalıştırılmadı: operatör anahtarı yokken UI’nin fail-closed davranışı test edildi.
- Bir saatlik gerçek duvar saati combat tick’i ve çok günlü cooldown elle beklenmedi. Buna karşılık deterministik campaign harness’i yakalama, ardışık beş fetih, aktif/kilitli hedef yetkisi, sezon kapanışı ve sezon 2 açılışını izole D1’de yeniden yürüttü.
- Üç eşzamanlı oyuncu fonksiyonel senaryo kapsamıdır; yüzlerce oyuncu, ağ kesintisi soak testi, websocket yükü ve hile/fraud penetrasyon testi değildir.
- Production ChatGPT Sites owner-only deploy’una giriş yapılmadı veya mutasyon gönderilmedi.
- Yerelleştirme İspanyolca ve İngilizce yüzeylerde denendi; diğer dil/locale veya manuel ekran okuyucu oturumu yapılmadı.

## 9. Son karar ve öncelik sırası

1. **GOV-001 — tamamlandı:** hedef seçimi server-authoritative `canVoteTarget` alanına bağlandı; aktif/hedef-kilitli halde CTA yok.
2. **MOD-002 — tamamlandı:** moderasyon drawer’ının açık durumu rapor ve panel yeniden oluşturma sonrasında korunuyor.
3. İlk oturumdaki taktik geri bildirimi ve cephe önerisini gerçek katılımcılı ürün deneyi olarak ölç.

Bu raporda açık ürün kusuru kalmadı. Gözlenen çekirdek savaş, ekonomi harcaması, çok oyunculu senkron, konsey ve erişilebilir ana akışlar kapalı beta için teknik olarak sağlamdır; gerçek insan katılımcı kabul kapısı bu otomasyon raporunun yerine geçmez.
