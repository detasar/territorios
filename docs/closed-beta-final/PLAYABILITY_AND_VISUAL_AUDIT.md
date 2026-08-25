# Territorios — Oynanabilirlik ve Görsel Denetim

## 1. Denetim kapsamı ve kanıt sınırı

Bu denetim aşağıdaki kaynaklara dayanır:

- `main` SHA `91b433224ed8d66f0a26b5b75b8220703d3f7217`;
- güncel React/CSS/i18n kaynakları;
- repo içindeki 1440 px desktop/council ve 390 px mobile ekran görüntüleri;
- üç oyunculu tarayıcı QA raporu;
- campaign harness, runtime smoke ve Playwright/Axe sonuçları.

Owner-only ChatGPT Sites oturumuna bağımsız bir kullanıcı olarak girilemediği için bu, yeni bir production oturumunda yapılmış piksel-diff denetimi değildir. Release öncesinde aynı kontrol owner-only staging deployment üzerinde yeniden yapılmalıdır.

## 2. Genel hüküm

Territorios teknik olarak bir demo olmaktan çıkmış, gerçek bir asenkron multiplayer strategy beta omurgasına ulaşmıştır. Harita ilk bakışta türü doğru anlatır; campaign loop kapanır; eşzamanlı saldırı/savunma katkıları ve konsey katmanı sosyal vaat üretir. Mevcut sanat yönü özgün, ciddi ve İspanya temasıyla uyumludur.

Buna rağmen kapalı beta öncesinde dört temel ürün sorunu çözülmelidir:

1. Harita sahiplik rengi gerçek fraksiyon kimliğini güvenilir biçimde anlatmıyor.
2. İlk ücretsiz katkının anlık ve beklenen etkisi yeterince güçlü gösterilmiyor.
3. Sekiz cephe yeni kullanıcıya karar yükü yaratıyor; oyuncunun kendi cepheleri önce gelmeli.
4. Az sayıda beta katılımcısının 52 fraksiyona dağılması sosyal döngüyü geçersiz kılabilir.

## 3. Skor kartı

| Boyut | Mevcut | Kapalı beta hedefi | Not |
| --- | ---: | ---: | --- |
| İlk bakışta türü anlama | 8/10 | 9/10 | Harita-first yön güçlü |
| İlk 3 dakikada aktivasyon | 6/10 | 8,5/10 | İnsan testi yapılmadı |
| Ana eylemin anlaşılması | 7/10 | 9/10 | Route ve eligibility iyi; impact zayıf |
| Harita sahiplik okunabilirliği | 4,5/10 | 8,5/10 | Beş renk 52 fraksiyonda tekrar ediyor |
| Savaş bağlamı | 8/10 | 9/10 | Origin/target ve side bilgisi var |
| Rol anlamı | 7,5/10 | 8,5/10 | Sayısal açıklamalar eklendi |
| Sosyal/governance potansiyeli | 8/10 | 8,5/10 | Küçük cohort dağılımı kritik |
| Görsel kimlik | 8,5/10 | 9/10 | Parşömen + lacivert + serif yön başarılı |
| Mobil kullanılabilirlik | 8/10 | 9/10 | 390 px reflow ve touch target yeşil |
| Erişilebilirlik temeli | 8,5/10 | 9/10 | Axe güçlü; manuel AT testi eksik |
| Geri dönüş nedeni | 6,5/10 | 8/10 | Tick/campaign var; bildirim ve mikro hedef sınırlı |
| Güven ve fair play | 9/10 | 9/10 | Deterministik motor ve %20 cap güçlü |

## 4. İyi çalışan oynanabilirlik unsurları

### 4.1 Harita doğrudan ana vaat

Kullanıcı oyunun bir territory strategy olduğunu açıklama okumadan anlayabilir. Province selection, siege pattern, active front selector, command panel ve route bilgisi aynı yüzeyde bulunur. Bu, kullanıcıyı soyut menüler yerine oyun dünyasında tutar.

### 4.2 Asenkron zaman modeli

Saatlik tick, dört capture window, 15 dakika mobilizasyon ve cooldown; oyunu sürekli çevrimiçi olma zorunluluğundan korur. Campaign loop’un yeni saldırıyı otomatik açması, dünya sürekliliğini sağlar.

### 4.3 Saldıran ve savunan oyuncu aynı savaşta anlamlı

QA’da iki tarafın eşzamanlı desteği doğru yere yazılmış ve diğer kullanıcının ekranına polling ile ulaşmıştır. Bu, çok oyunculu canlılık için en kritik kanıtlardan biridir.

### 4.4 Konsey ve roller savaş dışında kimlik yaratıyor

Yedi rol, beş koltuklu konsey, temsil oyu, hedef oyu ve duyuru sistemi; oyuncuyu yalnız “50 birlik gönder” butonuna indirgemiyor. Sabit mesaj sözlüğü de sosyal koordinasyonu moderasyon riski büyütmeden mümkün kılıyor.

### 4.5 Deterministik ve denetlenebilir sistem güven üretiyor

Battle replay, narrative summary, tam hash ayrıntısı ve append-only event yaklaşımı; özellikle gerçek para daha sonra tartışılırken güvenilir bir temel oluşturur. Teknik hash ana yüzeyde baskın değildir; isteyen ayrıntıyı açabilir.

## 5. Oynanabilirlik bulguları

### GP-001 — İlk katkının tatmini gecikiyor

**Öncelik:** P0 closed-beta comprehension

Mevcut ana eylem 50 takviye gönderir ve cüzdan/güç güncellenir; fakat oyuncu “bu hamle neden önemliydi?” sorusuna yalnız sayı değişiminden cevap arar. Bir saatlik tick bekleme, ilk oturumda düşük tatmin yaratabilir.

**Gerekli değişiklik:**

- Düğme sonrası kart içinde `+50` delta animasyonu/metni.
- Önceki → yeni güç karşılaştırması.
- Saldırı veya savunma tarafı etiketi.
- Sıradaki tick zamanı.
- `Tahmini` olarak etiketlenmiş siege etkisi veya attack-share aralığı.
- Gerçek tick geldiğinde tahmini panel sonuçla değiştir.
- Katkı event’ini narrative feed’e yaz.

**Kabul:** Katılımcıların en az %80’i ilk hamlenin neyi değiştirdiğini yardımsız açıklayabilmeli.

### GP-002 — Sekiz cephe yeni oyuncuda karar yükü yaratıyor

**Öncelik:** P0

Tek dropdown işlevsel fakat yeni oyuncu için tüm cepheler eşit önemde görünür. Oyuncu kendi fraksiyonunun katıldığı cepheyi bulana kadar yanlış seçim yapabilir.

**Gerekli değişiklik:**

- `Benim cephelerim` ve `Diğer cepheler` option group.
- Uygun cepheyi ilk açılışta varsayılan seç.
- Haritada kendi cepheleri için görünür marker/route.
- Diğer cephe seçildiğinde birincil CTA yerine observation state.
- `Neden destekleyemiyorum?` açıklaması.

**Kabul:** En az %90, bir cepheyi neden destekleyebildiğini veya destekleyemediğini doğru açıklamalı.

### GP-003 — Seçili province ile seçili battle iki ayrı zihinsel state

**Öncelik:** P1

Kod bu iki state’i ayırıyor ve route’u gösteriyor; yine de kullanıcı başka province’e bakarken command panelde active battle eylemi görmesi hâlinde ilişkiyi karıştırabilir.

**Gerekli değişiklik:**

- Province card başlığı: `İncelenen province`.
- Order card başlığı: `Seçili cephe`.
- Haritada origin ve target için farklı stroke/icon.
- Province tıklamak battle’ı değiştirmesin; battle seçmek haritada origin/target’a odaklansın.
- Observation state ve action state görsel olarak ayrılmalı.

### GP-004 — Roller bir günlük tek buton gibi hissedebilir

**Öncelik:** P1 / beta hypothesis

Rol etkileri artık sayısal açıklanıyor. Ancak her rolün gün boyunca kimliği güçlendiren ikinci bir görünür sinyali yoksa seçim yalnız günlük reward’a indirgenebilir.

**Kapalı beta için minimum:**

- Rol seçicide `Saldırı / Savunma / Lojistik / Sosyal` etiketi.
- Rol etkisi province ve battle kartında ilgili yerde görünür.
- Rol action sonrası değişen metric highlight edilir.
- Role göre bir küçük season objective gösterilir; yeni mekanik motoru eklemek gerekmez.

**Ölçüm:** Rol etkisini doğru açıklama ≥ %75; rol seçimi dağılımı ve sonraki gün action dönüşü raporlanır.

### GP-005 — 52 fraksiyon, 8–15 katılımcı için aşırı seyrek

**Öncelik:** P0 beta design

Katılımcılar özgürce 52 province’e dağılırsa council, announcement, attacker/defender coordination ve faction rivalry test edilemez.

**Gerekli beta operasyonu:**

- 4–6 odak province belirle.
- En az iki karşılıklı active front seç.
- Her kritik tarafta en az iki oyuncu hedefle.
- Katılımcıya “önerilen yoğun cepheler” göster; gerçek ikamet doğrulaması isteme.
- Cohort dağılımını test planında önceden tanımla.

### GP-006 — Orta vadeli hedef ana ekranda zayıf

**Öncelik:** P1

Season chip gün ve sezonu gösteriyor; fakat oyuncunun Crown yolunda nerede olduğu daha görünür olabilir.

**Gerekli değişiklik:**

- Territory sayısı.
- Liderle fark.
- Current phase.
- Son capture.
- Next planning/capture window.
- Crown tamamen sembolik ve parasal değersiz olarak açıklanır.

### GP-007 — Geri dönüş döngüsü yalnız world clock’a dayanıyor

**Öncelik:** P2 / ölçülecek hipotez

İç bildirim ve sessiz saatler var. Closed beta sırasında push/email ekleme. Önce şu geri dönüş nedenlerinin yeterli olup olmadığını ölç:

- hedef oylamasının kapanması;
- mobilizasyon başlangıcı;
- sıradaki capture window;
- province’in saldırıya uğraması;
- council term sonucu;
- günlük rol action.

D1/D7 düşükse daha sonra bounded opt-in notification tasarlanabilir.

## 6. Görsel güçlü yönler

### 6.1 Marka yönü

Krem/parşömen zemin, koyu lacivert komuta yüzeyi, coral-teal-gold aksanları ve Georgia/Geist kontrastı; generic SaaS dashboard yerine çağdaş bir strateji atlası hissi verir.

### 6.2 Hiyerarşi

Desktop’ta geniş harita ve sağ command rail doğru birincil/ikincil hiyerarşi kurar. Operations hub’ın aşağıda bulunması, governance ve store’u savaş yüzeyinden ayırır.

### 6.3 Harita insets ve durum deseni

Canary/autonomous insets, selected glow ve contested hatching coğrafi/kritik durumları destekler. Renk tek başına olmayan siege pattern doğru bir karardır.

### 6.4 Responsive ve erişilebilir temel

390 px’te horizontal overflow olmaması, 40×40 kontroller, roving tab index, durum açısından zengin aria-label ve focus-managed dialoglar güçlü bir temel oluşturur.

## 7. Görsel bulgular

### VIS-001 — Beş renk, 52 gerçek fraksiyonu temsil etmiyor

**Öncelik:** P0

Bootstrap her fraksiyona beş renk paletini döngüsel verir. İlişkisiz iki komşu aynı renge sahip olabilir. Harita conquest oyununun ana sahiplik yüzeyi olduğu için bu yalnız estetik değil, gameplay semantics sorunudur.

**Önerilen closed-beta çözümü:**

- Fraksiyon rengi deterministic HSL veya geniş erişilebilir palette üretilsin.
- Komşuluk grafiği, aynı/çok yakın renkleri komşu fraksiyonlara vermemek için kullanılsın.
- Aynı fraksiyonun bağlı territory’leri güçlü ortak dış contour ile gösterilsin.
- Viewer faction her zaman ek bir outline/glow taşısın.
- Active attacker origin için ayrı icon/stroke; target için hatching/pulse.
- Grayscale snapshot’ta selected, own ve target state hâlâ anlaşılmalı.

Alternatif daha sade MVP: tüm rakipleri desaturated neutral göster, viewer faction’ı belirgin renk, current attacker/defender’ı iki aksanla göster. Ancak spectator/Crown haritası için gerçek owner cluster’ı ayrıca görünür olmalıdır.

### VIS-002 — Legend veri modelini yanlış anlatıyor

**Öncelik:** P0

Legend `Tu facción`, `Casa del Mar`, `Liga Dorada`, `En disputa` etiketlerini gösteriyor. World modelinde global `Casa del Mar` veya `Liga Dorada` fraksiyonu yok; ayrıca navy/slate map renkleri legend’da hiç açıklanmıyor.

**Gerekli değişiklik:** Legend renk adı değil state semantiği anlatmalı:

- Tu fraksiyonun
- Diğer fraksiyonlar
- Saldırı kaynağı
- Kuşatma hedefi
- Seçili province

Dinamik legend yalnız mevcut state’leri göstermeli.

### VIS-003 — Top bar resource semantiği seçime göre değişiyor

**Öncelik:** P0

`Faction resources` altında kullanılan supply değeri `selectedState.supply`. Oyuncu düşman province seçtiğinde üst çubuk düşmanın veya gözlenen province’in supply’sini “fraksiyon kaynakları” gibi gösterebilir.

**Çözüm seçenekleri:**

A. Home province supply’sini sabit göster.
B. Fraksiyonun uygun toplam supply metric’ini hesapla.
C. Label’ı `Seçili province supply` yap ve seçili adı göster.

Closed beta için A veya C yeterlidir; anlam belirsiz kalmamalıdır.

### VIS-004 — Province crest gerçek sahibini yansıtmıyor

**Öncelik:** P1

Battle target dışında crest sabit coral sınıfını kullanıyor. Province başka owner/faction altında olsa bile crest yanlış kimlik hissi verebilir.

**Gerekli değişiklik:** Crest owner faction visual token’ına bağlanmalı; contested, occupied, home ve selected state’ler icon/pattern ile desteklenmelidir.

### VIS-005 — Front selector mekânsal bağlamı zayıf veriyor

**Öncelik:** P1

Dropdown rotayı metinle gösterir fakat sekiz savaşı harita üzerinde karşılaştırmayı zorlaştırır.

**Minimum çözüm:**

- Active front origin/target üzerinde numbered marker.
- Seçili route için line/arrow.
- `Benim cephelerim` badge.
- Dropdown seçildiğinde map focus.
- Marker cluster, küçük ekranlarda yalnız seçili ve viewer-relevant front’ları gösterir.

### VIS-006 — Bilgi yoğunluğu progressive disclosure gerektiriyor

**Öncelik:** P1

Topbar, onboarding card, front selector, map, command rail ve operations hub aynı sayfada. Deneyimli oyuncu için güçlü; ilk kullanıcı için yoğun.

**Gerekli yaklaşım:**

- Onboarding tamamlanana kadar leaderboard/store/replay’i görsel olarak ikincil yap.
- Birincil CTA sayısını state başına bire indir.
- Advanced combat modifiers accordion/details altında.
- Toast yerine bağlamsal inline feedback.

### VIS-007 — Hareket ve savaş hissi kontrollü biçimde artırılabilir

**Öncelik:** P2

Harita güçlü fakat world tick’i daha dramatik hissedebilir.

Kapalı beta için aşırı animasyon yerine:

- support delta pulse;
- siege bar authoritative transition;
- capture anında kısa border sweep;
- reduced-motion’da statik result banner;
- sound yok veya varsayılan kapalı

kullanılabilir.

## 8. Closed beta öncesi zorunlu görsel ekran seti

Aynı release SHA’sında şu ekranlar kaydedilmeli:

1. 1440×900 anonymous world.
2. 1440×900 joined attacker.
3. 1440×900 joined defender.
4. 1440×900 council planning.
5. 1440×900 mobilizing state.
6. 1440×900 completed capture/replay.
7. 768×1024 tablet.
8. 390×844 onboarding.
9. 390×844 active support.
10. 390×844 open dialog/moderation drawer.
11. 200% zoom core action.
12. grayscale/color-vision simulation ownership map.

Her screenshot için commit SHA, viewport, locale, user state ve D1 seed kaydedilmelidir.

## 9. Beta eğlence hipotezleri

Closed beta yalnız görev tamamlama testi değildir. Aşağıdaki hipotezler ölçülür:

| Hipotez | Kanıt |
| --- | --- |
| Province aidiyeti ilk seçimi anlamlı kılar | Province choice reason + 1–5 aidiyet skoru |
| Eşzamanlı destek world’ü canlı hissettirir | “Başka oyuncuların etkisini hissettim” skoru |
| Konsey yalnız büyük spender’ların değil herkesin sistemi gibi görünür | Governance fairness skoru ve oy katılımı |
| Saatlik tick merak üretir fakat baskı yaratmaz | Return intent, notification pressure skoru |
| %20 cap adalet algısını korur | Payer/non-payer fairness açıklaması |
| Harita conquest ilerlemesini açık anlatır | Ownership comprehension task |
| Replay sonuçları güvenilir kılar | Result trust skoru |

## 10. Görsel ve oynanabilirlik GO kriteri

Closed beta erişimi yalnız şu durumda açılır:

- VIS-001, VIS-002 ve VIS-003 kapalıdır.
- GP-001, GP-002 ve GP-005 minimum çözümü uygulanmıştır.
- 390/768/1440 ekran seti kabul edilmiştir.
- Automated Axe sıfır ihlal verir; keyboard/reduced-motion/200% zoom manuel smoke geçer.
- İlk oturumda etkin tek CTA ve açık next action vardır.
- Haritada owner, viewer faction, active origin, target, contested ve selected state karıştırılmaz.
- Gerçek katılımcı testinde core task, front comprehension ve payment/property misconception eşikleri geçer.
