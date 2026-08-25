# Territorios — kapsamlı manuel QA ve çok oyunculu test raporu

**Tarih:** 25 Ağustos 2026
**Test yaklaşımı:** Gerçek tarayıcı etkileşimi (tıklama, klavye, görünür ekran, ayrı oturumlar) + mevcut otomatik test kapıları
**Sonuç:** İlk turda bulunan dokuz P2 ve üç P3 bulgunun tamamı 25 Ağustos 2026 düzeltme turunda kapatıldı. İzole başlangıç ve tamamlanmış onboarding durumlarında Axe WCAG 2.2 AA kapısı temiz; oyun kapalı beta için teknik olarak hazır.

## 0. Düzeltme sonrası sonuç

Bu bölüm ilk test turundaki tarihsel gözlemlerin yerine geçen son durumu kaydeder. Aşağıdaki 12 bulgunun tamamı kod, regresyon testi ve gerçek tarayıcı doğrulamasıyla kapatıldı:

- `BUG-STATUS-001` / `BUG-I18N-003`: oyun ve community feedback’i il, cephe veya dil değişince artık taşınmıyor.
- `BUG-FRONT-009`: takviye kartı seçili il ne olursa olsun emir hedefini `origin → target` olarak gösteriyor; düğmenin erişilebilir adı da aynı rotayı içeriyor.
- `BUG-COPY-002`: rol eylemi, duyuru, oy, rapor, mute ve block ayrı başarı metinleri kullanıyor.
- `BUG-MOBILE-008` / `UX-MOBILE-010`: 390×844 görünümde nav/legend örtüşmesi `0 px`; merkez, tam ekran ve yardım kontrolleri görünür ve en az 34 px.
- `A11Y-011` / `A11Y-012`: modallar odağı içeri alıyor, Tab’ı içeride tutuyor, Escape ile kapanıyor ve odağı tetikleyiciye döndürüyor; tamamlanmış rozet koyu metinle AA kontrastını geçiyor.
- `BUG-LEGAL-004`: beş hukuk belgesinin tamamı İspanyolca ve İngilizce; mağaza locale’i hukuk bağlantılarına taşınıyor.
- `UX-MAP-005`: ana harita sahne genişliğinin en az %53’ünü ve yüksekliğinin en az %45’ini dolduruyor; Kanarya Adaları ile Ceuta/Melilla ayrı inset’lerde korunuyor.
- `UX-REPLAY-006`: replay artık oyuncu odaklı sezon kroniği; savaş tick’leri önce/sonra kuşatma yüzdesini ve kayıpları anlatıyor, tam hash açılır doğrulama alanında kalıyor.
- `BUG-PAY-007`: negatif, artan ve günlük > sezon limitleri istek gönderilmeden alan/kural bazında, seçili dilde açıklanıyor.

Son kapılar: `150/150` test, lint, typecheck, production build, %80.15 branch coverage, temiz D1 migration, production runtime smoke ve başlangıç + tamamlanmış onboarding içeren `4/4` izole Playwright/Axe senaryosu PASS.

## 1. Kapsam ve ortam

Testler kaynak koduna dokunmadan, `/Users/Lenovo1/territorios` içindeki yerel preview üzerinde yürütüldü.

- Uygulama: Vinext/Vite preview, `http://localhost:3020/`
- Veri: yalnızca bu test için açılmış geçici D1 durumu (`/tmp/territorios-preview.a9HGlD`)
- Çok oyunculu dünya: ayrı geçici Worker + D1 (`/tmp/territorios-multi.45Bhat`)
- Tarayıcı: Codex in-app browser, görünür sekmeler ve gerçek DOM/erişilebilir adlar
- Oyuncular:
  - **Tester A:** Madrid, Estratega
  - **Tester B:** Toledo, Defensor
  - **Tester C:** Madrid, Heraldo
- Aynı dünya üzerindeki proxy sekmeleri: A `:3033`, B `:3032`, C `:3034`
- Kapsanan ekran genişlikleri: normal masaüstü görünümü; 390×844 otomatik reflow kapısı; manuel mobil görünüm ekran görüntüsü
- Test verisi ve proxy kimlikleri üretim hesabı değildir; üretim D1’e dokunulmadı.

## 2. Yönetici özeti

### Çalışan ana akışlar

- İlk açılışta il/rol seçimi ve katılım yönlendirmesi çalışıyor.
- 52 il/özerk şehir haritası yükleniyor; il seçimi ve aktif cephe seçimi çalışıyor.
- Oyuncunun cepheye katılıp katılmadığı doğru hesaplanıyor; katılmayan oyuncuda destek eylemi gizleniyor.
- İki oyuncunun aynı Madrid → Toledo cephesinde eşzamanlı ücretsiz takviye göndermesi atomik çalışıyor.
- Hızlı çift tıklamada tek takviye işlemi tüketiliyor; aynı kaynak iki kez harcanmadı.
- Geri sayım canlı ilerliyor.
- Yedi rol arasından seçim, günlük rol eylemi ve günlük eylem kilidi çalışıyor.
- Beş sandalyeli konseyde temsilci oyu, hedef oyu ve hedef kilitleme akışı çalışıyor.
- Konsey duyurusu, başka oyuncunun faydalı oyu, insan incelemesine rapor ve sessize alma zinciri çalışıyor.
- Replay, leaderboard, paylaşım menüsü, il deep-link’i, profil ve harita yardım pencereleri açılıyor.
- İngilizce ana oyun/mağaza arayüzü ve İspanyolca arayüz çalışıyor.
- Satın alma anahtarları yokken Stripe sandbox düğmeleri güvenli biçimde devre dışı kalıyor.
- Console error/warning görülmedi; başlangıç/izole state Axe kapısı geçti, fakat ilerlenmiş hesapta `A11Y-012` kontrast ihlali bulundu. 390 px taşma kapısı geçti.

### İlk turda kullanıcıyı rahatsız eden / keyfi azaltan noktalar (tamamı kapatıldı)

1. Başka bir cepheye geçince önceki cephenin “takviye kaydedildi” mesajı ekranda kalıyor. Oyuncu bu mesajın yeni cepheye ait olduğunu sanabilir.
2. Rol eylemi, duyuru, faydalı oy, rapor ve sessize alma sonrası “Tercihler kaydedildi.” mesajı gösteriliyor. Eylem başarıyla sonuçlansa bile oyun, yanlış bir ayarın değiştiğini söylüyor.
3. İngilizceye geçişte eski İspanyolca eylem mesajı status alanında kalıyor.
4. İngilizce mağazadaki hukuki bağlantılar İspanyolca hukuk metnine götürüyor; ödeme/consent bağlamında anlaşılabilirlik riski var.
5. Harita sahnesi geniş, fakat İspanya geometrisi sahnenin ortasında küçük kalıyor. Oyun harita merkezli olduğu için boş alan, il sınırlarının okunabilirliğini ve hedef seçme hissini azaltıyor.
6. Replay daha çok teknik hash/ledger kaydı gibi görünüyor; oyuncuya “hangi cephede ne değişti, neden önemli?” anlatısını vermiyor.
7. Mobilde sabit “Harita/Konsey/Sıralama” çubuğu harita lejandının alt kısmının üstüne biniyor.
8. Haritanın saldıran/origin ilini seçince aktif cephe aynı kalıyor; il kartı origin ili gösterirken takviye düğmesi aktif cephe hedefine gönderim yapıyor.
9. Mobilde harita yardım/merkez düğmeleri CSS ile görünmez; yardım metni hâlâ klavye `F` tam ekran kısayolunu söylüyor, fakat dokunmatik kullanıcı için karşılığı yok.
10. Yardım/profil modalları açıldığında klavye odağı modala taşınmıyor; odak açma düğmesinde kalıyor.
11. Onboarding tamamlandığında altın `1 · 2 · 3` rozeti beyaz yazıyla düşük kontrastta kalıyor; bu durum yalnızca oyun ilerlemiş state’te ortaya çıkıyor.

## 3. Test matrisi

| ID | Senaryo | Oyuncu(lar) | Sonuç | Not |
|---|---|---|---|---|
| SP-01 | İlk açılış/onboarding | Yeni C | PASS | “İl ve rol seç” → katılım → ilk takviye yönlendirmesi çalıştı. |
| SP-02 | Harita yükleme ve il seçimi | A/B/C | PASS | 52 erişilebilir map button bulundu. |
| SP-03 | Harita klavyesi | local_seedy | PASS | Home → Araba/Álava, ArrowRight → Albacete, End → Melilla. |
| SP-04 | Harita yardım/profil/merkezle | local_seedy | PASS | Dialog’lar açılıp kapandı. |
| SP-05 | Aktif cephe seçimi | local_seedy/B | PASS · FIXED | Katılmayan cephede destek gizli; eski status temizleniyor. |
| SP-06 | Tek ücretsiz destek | local_seedy | PASS | 100 → 50 → 0; düğme kaynak bitince devre dışı. |
| MP-01 | Aynı dünyaya iki oyuncu katılımı | A/B | PASS | A Madrid saldıran, B Toledo savunan oldu. |
| MP-02 | Eşzamanlı destek | A/B | PASS | Saldıran ve savunan güçleri doğru yönde arttı. |
| MP-03 | Hızlı çift tıklama | B | PASS | 250 → 200; yalnız bir 50’lik işlem işlendi. |
| MP-04 | Temsilci oyu | A/B/C | PASS | Oy kaydedildi, sandalye doldu, tekrar oy kilitlendi. |
| MP-05 | Hedef oyu | B | PASS | Tedarikli hedef seçildi; hedef oyundan sonra alanlar kilitlendi. |
| MP-06 | Konsey duyurusu | B/C | PASS · FIXED | Duyuru yayınlandı ve doğru başarı metni gösterildi. |
| MP-07 | Faydalı oy | C | PASS · FIXED | Sayaç 0 → 1; eyleme özgü feedback gösterildi. |
| MP-08 | Rapor + sessize alma | C | PASS · FIXED | Rapor, mute ve block ayrı başarı metinleri kullanıyor. |
| SP-07 | Günlük rol eylemi | local_seedy/C | PASS · FIXED | Ödül/contribution arttı; günlük rol eylemi başarı metni doğru. |
| SP-08 | Replay/leaderboard | local_seedy | PASS · FIXED | Oyuncu kroniği ve açılır tam hash doğrulaması mevcut. |
| SP-09 | Paylaşım/deep-link | local_seedy | PASS | `/province/45`, WhatsApp/X href ve hukuk rotası açıldı. |
| SP-10 | İngilizce ayar kaydı | local_seedy | PASS · FIXED | Ana UI çevrildi; eski dilde status taşınmıyor. |
| SP-11 | Mağaza/consent | local_seedy | PASS · FIXED | Checkout güvenli; hukuk ve limit hataları seçili dilde. |
| SP-12 | Mobil/reflow | otomatik Playwright | PASS | 390 px horizontal overflow yok. |
| SP-13 | Console/network gözlemi | tüm sekmeler | PASS | Oyun sekmesi ve A/B/C’de error/warn yok; HTTP istekleri 200. |
| SP-14 | Gerçek 390 px ekran | local_seedy | PASS · FIXED | Overflow ve nav/legend örtüşmesi yok. |
| SP-15 | Cephe origin ilini seçme | izole Origin Tester | PASS · FIXED | Takviye kartı Madrid → Toledo rotasını açıkça gösteriyor. |
| SP-16 | Mobil kontrol keşfi | gerçek 390 px | PASS · FIXED | Merkez, tam ekran ve yardım kontrolleri görünür. |
| SP-17 | Modal klavye odağı | izole Origin Tester | PASS · FIXED | Focus trap, Escape ve focus restore geçti. |
| SP-18 | İlerlenmiş onboarding Axe taraması | izole tamamlanmış state | PASS · FIXED | Tamamlanmış onboarding Axe WCAG 2.2 AA: 0 ihlal. |

## 4. Bulgular

### BUG-STATUS-001 — Aktif cephe değişince eski başarı mesajı kalıyor

- **Öncelik:** P2 — orta önem, yanlış bağlamda güven/karar riski
- **Durum:** DÜZELTİLDİ — il ve cephe seçimleri eski komut mesajını temizliyor.
- **Adımlar:**
  1. Madrid → Toledo cephesini seç.
  2. “50 takviye gönder” eylemini çalıştır.
  3. “50 refuerzos registrados en el ledger de batalla.” mesajını gör.
  4. Aktif cepheyi Araba/Álava → Burgos yap.
- **Beklenen:** Status temizlenmeli, yeni cepheye göre güncellenmeli veya “önceki eylem” diye açıkça etiketlenmeli.
- **Gerçekleşen:** Araba/Burgos’ta oyuncu cepheye katılmıyor ve destek düğmesi yok; buna rağmen eski Madrid/Toledo takviye mesajı status bölgesinde kalıyor.
- **Kullanıcı etkisi:** Oyuncu, takviyenin seçili yeni cepheye de işlendiğini düşünebilir.
- **Teknik ipucu:** `commandMessage` cephe seçiminde temizlenmiyor ve destek kartında koşulsuz render ediliyor (`src/components/territorios-game.tsx`).

### BUG-FRONT-009 — Origin ili seçilince cephe kartı ile takviye hedefi ayrışıyor

- **Öncelik:** P2 — orta önem, ana savaş eyleminde bağlam karışıklığı
- **Durum:** DÜZELTİLDİ — takviye kartı ve erişilebilir düğme adı aktif rotayı açıkça gösteriyor.
- **Adımlar:**
  1. Yeni oyuncu ile Madrid’i temsil et; Madrid → Toledo cephesinde ücretsiz takviye hakkı olsun.
  2. Haritada hedef Toledo yerine saldıran/origin Madrid ilini seç.
  3. Sağ kartı ve “50 takviye gönder” düğmesini incele.
  4. Takviyeyi gönder.
- **Beklenen:** Origin il seçimi aktif cepheyi açıkça korumalı ve takviye kartında “Madrid → Toledo” hedefini görünür kılmalı; tercihen cephe hedefi tekrar seçilmeli.
- **Gerçekleşen:** Sağ kart “Madrid / Başkent / istikrarlı il” gösteriyor, üstte aktif cephe “Atakasın” diyor ve takviye düğmesi kullanılabilir kalıyor. İşlem olay günlüğünde Madrid → Toledo’ya yazılıyor; kartta hedef yolu görünmediği için oyuncu Madrid’i güçlendirdiğini sanabilir.
- **Kullanıcı etkisi:** Savaş kaynakları yanlış hedefe harcanabilir; bu, harita üzerinden oynayan yeni oyuncu için yüksek sürpriz ve düşük güven yaratıyor.
- **Teknik ipucu:** `selectTerritory()` yalnızca seçilen kod bir battle `targetTerritoryCode` ise `selectedBattleId` değiştiriyor; origin kodunda mevcut cephe seçimi korunuyor.

### BUG-COPY-002 — Farklı işlemler “Tercihler kaydedildi” diye raporlanıyor

- **Öncelik:** P2 — orta önem, eylem güvenini azaltıyor
- **Durum:** DÜZELTİLDİ — her mutasyon eyleme özgü yerelleştirilmiş başarı mesajı kullanıyor.
- **Yeniden üretilen eylemler:** günlük rol eylemi, konsey duyurusu, faydalı oy, rapor gönderme ve sessize alma.
- **Beklenen:** “Rol eylemi tamamlandı”, “Duyuru yayınlandı”, “Oy kaydedildi”, “Rapor incelemeye gönderildi”, “Oyuncu sessize alındı” gibi eyleme özgü geri bildirim.
- **Gerçekleşen:** Bu işlemlerin birden çoğunda `Preferencias guardadas.` / `Preferences saved.` görülüyor. Bu ifade yalnızca ayar kaydetme için doğru.
- **Kullanıcı etkisi:** Özellikle moderasyon ve savaş eylemlerinde kullanıcı sistemin doğru nesneyi değiştirdiğinden emin olamıyor.
- **Teknik ipucu:** `CommunityHub` içinde `copy.saved` birden fazla mutasyona veriliyor; aynı bileşen ayar kaydetmede de bu metni kullanıyor (`src/components/community-hub.tsx`).

### BUG-MOBILE-008 — Sabit mobil navigasyon harita lejandının üstüne biniyor

- **Öncelik:** P2 — mobil harita okunabilirliğini azaltıyor
- **Durum:** DÜZELTİLDİ — son 390×844 ölçümünde örtüşme `0 px`.
- **Kanıt:** `viewportCapability.set({ width: 390, height: 844 })` sonrasında `.map-legend` dikdörtgeni `top=798.5, bottom=848.5`; sabit `.mobile-nav` `top=782, bottom=832`. İki alan yaklaşık 33.5 px boyunca üst üste geliyor.
- **Beklenen:** Sabit çubuk harita içeriğini örtmemeli; alt padding veya nav için güvenli alan bırakılmalı.
- **Gerçekleşen:** Ekran görüntüsünde legend’ın alt kısmı nav’ın arkasında kalıyor. Yatay overflow yok; sorun örtüşme/z-index ve dikey kullanılabilirlik.
- **Kullanıcı etkisi:** Renk lejandının bir bölümü okunmuyor; harita durumlarını anlamak zorlaşıyor ve görsel kalite düşüyor.
- **Teknik ipucu:** `.mobile-nav` `position: fixed` ve `z-index: 20`; `.map-legend` map-stage içinde alt kenara sabitlenmiş durumda (`app/globals.css`).

### UX-MOBILE-010 — Mobilde harita yardım ve merkezleme eylemleri keşfedilemiyor

- **Öncelik:** P3 — yardımcı özellik; ana savaş akışı çalışıyor
- **Durum:** DÜZELTİLDİ — merkez, tam ekran ve yardım dokunmatik kontrolleri mobilde görünür.
- **Kanıt:** Mobil viewport’ta `.map-actions button` öğeleri DOM’da bulunuyor, fakat ölçülen dikdörtgenleri `0×0`; CSS onları görünmez yapıyor. Aynı ekranda “Pulsa F para pantalla completa” açıklaması kalıyor.
- **Beklenen:** Dokunmatik alternatif (küçük floating yardım/merkez düğmesi veya mobil menü) ya da mobilde klavye kısayolu metninin kaldırılması.
- **Gerçekleşen:** Kullanıcı harita yardımını ve merkezlemeyi bulamıyor; tam ekran için yalnızca fiziksel klavye kısayolu anlatılıyor.
- **Kullanıcı etkisi:** İlk kez oynayan mobil kullanıcı harita kontrol modelini öğrenemiyor.

### A11Y-011 — Yardım/profil modalları odağı içine almıyor

- **Öncelik:** P2 — klavye ve ekran okuyucu kullanıcıları için modal bağlamı belirsiz
- **Durum:** DÜZELTİLDİ — focus trap, Escape ve tetikleyiciye focus restore gerçek tarayıcıda geçti.
- **Adımlar:**
  1. “Harita yardımını göster” düğmesine bas.
  2. Açılan dialog’un `document.activeElement` değerini kontrol et.
- **Beklenen:** Odak dialog içindeki “Kapat” düğmesine taşınmalı; Tab arka plana kaçmamalı; Escape ile kapanmalı ve odak tetikleyiciye dönmeli.
- **Gerçekleşen:** Dialog açılıyor, ancak odak `Mostrar ayuda del mapa` açma düğmesinde kalıyor; Escape basışı da dialog’u kapatmıyor. Dialog JSX’inde focus restore/trap veya Escape handler yok; profil dialog’u da aynı deseni kullanıyor.
- **Kullanıcı etkisi:** Klavye kullanıcısı modalın içine girdiğini anlamayabilir; ekran okuyucu arka plan kontrollerini modal açıkken dolaşabilir.
- **Teknik ipucu:** `src/components/territorios-game.tsx` içindeki `surface-dialog` blokları yalnızca `role="dialog" aria-modal="true"` tanımlıyor; focus yönetimi bulunmuyor.

### A11Y-012 — Tamamlanmış onboarding rozeti düşük kontrastlı

- **Öncelik:** P2 — Axe etkisi `serious`; tamamlanmış kullanıcı akışında WCAG 1.4.3 riski
- **Durum:** DÜZELTİLDİ — tamamlanmış onboarding state’i ayrı E2E Axe senaryosunda 0 ihlal.
- **Adımlar:**
  1. Hazırlığı tamamlanmış bir hesapla oyunu aç.
  2. `AxeBuilder` WCAG 2.2 AA taramasını çalıştır.
- **Beklenen:** Onboarding rozeti metni en az 4.5:1 kontrasta sahip olmalı.
- **Gerçekleşen:** `.onboarding-card > span` için foreground `#ffffff`, background `#c69b42`, oran `2.57:1`; Axe `color-contrast` ihlali veriyor. Aynı ihlal ana oyun ve sandbox store Axe adımlarını etkiledi; doğrudan preview Playwright koşusunda 3 testten 2’si bu nedenle başarısız oldu.
- **Kullanıcı etkisi:** Beyaz `1 · 2 · 3` metni bazı kullanıcılar için zor okunuyor; erişilebilirlik kapısı ilerlenmiş state’te yeşil görünmüyor.
- **Teknik ipucu:** `app/globals.css` içinde `.onboarding-card > span` beyaz metin kullanıyor; `.onboarding-complete > span` arka planı `var(--gold)` (`#c69b42`) yapıyor.

### BUG-I18N-003 — Locale değişince eski status yeniden çevrilmiyor/temizlenmiyor

- **Öncelik:** P2 — orta önem, İngilizce akışta dil bütünlüğünü bozuyor
- **Durum:** DÜZELTİLDİ — locale değişiminde eski feedback gösterilmiyor.
- **Adımlar:**
  1. İspanyolca iken destek veya başka bir oyun eylemi yap.
  2. Ayarlarda English seçip “Save preferences” ile kaydet.
  3. Ana arayüze dön.
- **Beklenen:** Eski mesaj ya çevrilmeli ya da locale değişiminde temizlenmeli.
- **Gerçekleşen:** Ana arayüz İngilizceye dönüyor; eski İspanyolca `50 refuerzos registrados...` status’u kalıyor.
- **Kullanıcı etkisi:** Çok dilli kullanıcı farklı dillerden karışık, güven vermeyen bir geri bildirim görüyor.

### BUG-LEGAL-004 — İngilizce UI, İspanyolca hukuk metnine bağlı

- **Öncelik:** P2 — ödeme/consent açılmadan önce önemli; ücretsiz oyun bloklanmıyor
- **Durum:** DÜZELTİLDİ — beş hukuk belgesinin eksiksiz İngilizce sürümü ve locale bağlı linkleri var.
- **Adımlar:**
  1. Settings → English seçip kaydet.
  2. Sandbox store → Terms bağlantısına tıkla.
- **Beklenen:** İngilizce hukuk metni veya açık bir “bu belge İspanyolcadır” uyarısı.
- **Gerçekleşen:** Bağlantı `Condiciones de la beta de Territorios` başlıklı tamamen İspanyolca sayfaya açılıyor.
- **Kullanıcı etkisi:** İngilizce consent kutusunu işaretleyen kullanıcı kabul ettiği şartları anlayamayabilir. Checkout şu anda anahtar yokluğu nedeniyle disabled olsa da bu, paid-beta hazırlık kapısıdır.
- **Teknik ipucu:** `app/legal/[slug]/page.tsx` belgeleri locale almadan yalnızca İspanyolca tanımlıyor.

### UX-MAP-005 — Harita sahnesinde düşük bilgi yoğunluğu

- **Öncelik:** P2 UX — harita oyununun okunabilirliği ve keyfi azalıyor
- **Durum:** DÜZELTİLDİ — ayrı inset projeksiyonu ve otomatik doluluk eşiği eklendi.
- **Gözlem:** Masaüstü ekran görüntüsünde map-stage büyük bir alan kaplıyor; İspanya geometrisi merkezde küçük bir siluet olarak kalıyor. İl butonları erişilebilir olsa da görsel hedefler ve sınırlar fazla boşluk içinde kayboluyor.
- **Beklenen:** Harita, sahnenin kullanılabilir alanını daha iyi doldurmalı; seçili il ve cephe daha belirgin olmalı.
- **Gerçekleşen:** Harita yükleniyor ve etkileşim çalışıyor, fakat görsel ilk bakışta “boş bir panel + küçük harita” hissi veriyor.
- **Kullanıcı etkisi:** Harita merkezli oyunda keşif, hedef seçme ve coğrafi ilişki kurma hissi zayıflıyor.
- **Not:** Otomatik 390 px reflow ve overflow kapısı geçti; bu bulgu taşma değil, ölçek/projeksiyon yoğunluğu bulgusudur.

### UX-REPLAY-006 — Replay teknik denetim kaydı gibi, oyuncu anlatısı zayıf

- **Öncelik:** P3 UX — işlev var, açıklayıcılık düşük
- **Durum:** DÜZELTİLDİ — oyuncu kroniği, önce/sonra sonuç özeti ve açılır bütünlük kanıtı eklendi.
- **Gözlem:** Replay listesi olay özeti ve kısa hash gösteriyor. Örneğin “50 takviye Madrid → Toledo’ya atandı” ve “ücretsiz rol eylemi tamamlandı” görülebiliyor; ancak cephe sonucu, neden-sonuç, hedef değişimi ve oyuncunun karar etkisi anlatı olarak sunulmuyor.
- **Öneri:** Audit hash korunarak her olay için cephe, önce/sonra güç, hedef, aktör rolü ve sonucu tek satırlık insan-okur özetle gösterilmeli.

### BUG-PAY-007 — İngilizce geçersiz harcama limiti geri bildirimi fazla genel

- **Öncelik:** P3 — düşük önem, yalnızca hatalı ödeme ayarı girişinde
- **Durum:** DÜZELTİLDİ — çapraz alan ve azaltma kuralları locale’e özgü açıklanıyor.
- **Adımlar:** Sandbox store’da günlük limiti 200, sezon limitini 150 yapıp kaydet.
- **Beklenen:** Hangi alanın neden geçersiz olduğunu söyleyen, seçili dilde bir hata.
- **Gerçekleşen:** İngilizcede `Private payment controls could not be loaded.`; İspanyolcada `Límites de gasto inválidos.` görülüyor. Her iki metin de alanlar arası ilişkiyi açıklamıyor.
- **Kullanıcı etkisi:** Kullanıcı ağ/servis hatası olduğunu sanabilir; limit kuralını anlayamaz.
- **Teknik ipucu:** `PaymentPanel` invalid response’u İngilizcede genel `labels.unavailable` metnine indiriyor (`src/components/payment-panel.tsx`).

## 5. Başarılı doğrulamalar ve güvenlik sınırları

### Çok oyunculu

- A ve B aynı geçici D1 dünyasında birbirinden bağımsız kimliklerle oynadı.
- A Madrid’i Estratega, B Toledo’yu Defensor, C Madrid’i Heraldo olarak temsil etti.
- Aynı takviye eylemi iki tarayıcıda eşzamanlı gönderildi; saldıran/defans gücü ve cüzdanlar beklenen yönde değişti.
- B katılmadığı Araba/Álava → Burgos cephesinde destek gönderemedi; UI düğmeyi kaldırdı.
- Temsilci oyları kullanıcı başına tek oy olarak kilitlendi.
- Hedef seçimi yalnızca konsey üyesinde göründü; oy sonrası hedef alanı disabled oldu.
- C, B’nin duyurusunu görebildi; faydalı oy, rapor ve sessize alma kontrolleri çalıştı.

### Erişilebilirlik ve klavye

- Harita 52 erişilebilir buton/path rolüyle bulundu.
- Roving focus: Home, ArrowRight ve End doğru illere taşıdı; aria-label içinde il, kontrol, durum ve savunma bilgisi var.
- 390 px Playwright reflow testinde yatay taşma yok.
- Başlangıç/izole state otomatik Axe WCAG 2.2 AA taraması: ihlal yok; ilerlenmiş hesap state’inde `A11Y-012` nedeniyle kontrast ihlali var.

### Hata ve güvenli ödeme davranışı

- Oyun sekmesi ve üç oyuncu sekmesinin browser console error/warn listeleri boş.
- Preview sunucu loglarında test sırasında 4xx/5xx oyun isteği gözlenmedi.
- Stripe test anahtarları yokken üç checkout düğmesi disabled; ücretsiz oyun açık kalıyor.
- Hızlı çift tıklama aynı ücretsiz desteği iki kez yazmadı.
- İlk çok oyunculu denemede görülen 403, test proxy’sinin yanlış `Origin` taşımasından kaynaklandı; Origin düzeltildikten sonra aynı akış başarılı oldu. Bu oyun kusuru olarak sınıflandırılmadı.

## 6. Otomatik kapılar

Komutlar ve sonuçlar:

```text
npm run verify                    19 dosya, 150/150 PASS; coverage/lint/typecheck/build PASS
bash scripts/verify-browser-e2e.sh 4/4 PASS, BROWSER_E2E_PASS isolated_d1=true
npm run verify:migration          D1_MIGRATION_PASS tables=29 triggers=19 integrity=ok
npm run verify:runtime            RUNTIME_SMOKE_PASS territories=52 fronts=8
npm run lint                      PASS
npm run typecheck                 PASS
npm run build                     PASS
```

İzole Playwright koşusu yeni oyuncuyu oyuna alıp ilk desteği göndererek onboarding’i gerçek API akışıyla tamamlıyor; ardından tamamlanmış state üzerinde ikinci Axe taramasını çalıştırıyor. Hem başlangıç hem tamamlanmış state `0` ihlalle geçti.

E2E kapsamı:

- WCAG 2.2 AA Axe taraması: başlangıç ve tamamlanmış onboarding state’lerinde 0 ihlal
- Klavye tab akışı: PASS
- 390 px reflow / horizontal overflow: PASS
- Sandbox store ve disabled checkout guard: PASS
- Legal terms rotası: PASS

## 7. Test edilmeyen veya sınırlı kalan alanlar

- Gerçek Stripe test-mode Checkout Session oluşturulmadı; yerel preview’da operator key yok ve checkout düğmeleri bilerek disabled.
- Bir saatlik gerçek bekleme ile capture/repel tick’i manuel olarak beklenmedi. Bu rapor canlı geri sayım ve kampanya UI’sını test eder; uzun süreli sezon simülasyonunu yeniden çalıştırmıyor.
- Üç kullanıcıyla fonksiyonel çok oyunculu akış doğrulandı; yüzlerce eşzamanlı kullanıcı, websocket yükü veya uzun süreli polling soak testi yapılmadı.
- Production/ChatGPT Sites deploy’u değiştirilmedi; bütün mutation testleri geçici D1/proxy üzerinde kaldı.
- Clipboard sonucu tarayıcı köprüsünden bağımsız okunamadı; UI “Link copied” verdi ve share href doğrulandı, fakat sistem panosunun fiziksel içeriği ayrı doğrulanmadı.

## 8. Tamamlanan düzeltme sırası

1. Feedback bağlamı ve eyleme özgü copy tamamlandı.
2. İngilizce hukuk belgeleri ve locale bağlı consent linkleri tamamlandı.
3. Harita projeksiyonu, mobil kontroller ve örtüşme düzeltildi.
4. Replay anlatısı ile gizlenebilir audit kanıtı tamamlandı.
5. Ödeme limitlerinin alan/kural bazlı doğrulaması tamamlandı.
6. Birim, E2E, Axe, migration ve runtime kapıları yeniden çalıştırıldı.

## 9. Son karar

**Fonksiyonel karar: KAPALI BETA İÇİN HAZIR.** Rapordaki 12 bulgunun tamamı kapatıldı; kritik veri kaybı, çift harcama, erişim veya console hatası görülmedi. Gerçek ödeme anahtarları hâlâ bilinçli olarak yapılandırılmamış durumda ve üretim Sites/D1 bu düzeltme turunda değiştirilmedi.
