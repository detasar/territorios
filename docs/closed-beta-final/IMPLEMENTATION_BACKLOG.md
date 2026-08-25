# Territorios — Final Closed Beta Implementation Backlog

## Kullanım kuralları

- Görevler sırasıyla yürütülür; P0 bitmeden P1 başlanmaz, P1 bitmeden release candidate dondurulmaz.
- Her görev tek bir release SHA’ya bağlı kanıt üretir.
- `Done`, yalnız kod yazıldı anlamına gelmez; test, screenshot veya operasyon kanıtı gerektirir.
- Public erişim ve canlı para bu backlog kapsamında değildir.
- Önerilen owner alanları: `ENG`, `PRODUCT`, `DESIGN`, `QA`, `PRIVACY`, `MODERATION`, `OPS`.

## P0 — Closed beta release blocker’ları

### REL-001 — Release source-of-truth hizalaması

**Owner:** ENG/OPS  
**Bağımlılık:** Yok  
**Dosyalar:** `package.json`, `README.md`, `progress.md`, release workflow/notları

**Yapılacaklar**

- Release candidate sürümünü `0.2.0-beta.1` yap.
- Eski `v0.1.0` tag’ini değiştirme.
- Candidate commit’i dondur ve yeni annotated tag üret.
- Deployment metadata/health çıktısına version + commit SHA ekle.
- Test raporlarında aynı SHA’yı kaydet.

**Kabul**

- UI/health, GitHub tag ve deployed artifact aynı SHA’yı gösterir.
- Release notu açıkça “closed beta, no real money” der.

**Kanıt:** tag URL, SHA, health/screenshot, CI run.

---

### REL-002 — İlk sezonu gerçek gün 1’den başlat

**Owner:** ENG  
**Bağımlılık:** REL-001  
**Dosya:** `db/world-bootstrap.ts`

**Yapılacaklar**

- Fresh world için `startsAt = now` davranışını kullan.
- `now - 11 days` demo offset’ini yalnız explicit test fixture/seed parametresine taşı.
- Existing-season rollover davranışını koru.
- Fresh D1 testinde `seasonDay === 1` kanıtla.

**Kabul**

- Yeni D1 ilk snapshot’ta gün 1 ve yaklaşık 28 gün remaining gösterir.
- Campaign/migration/runtime testleri yeşil kalır.

**Test:** unit + fresh-bootstrap smoke.

---

### DB-001 — Kapalı beta D1 rollout stratejisini seç ve uygula

**Owner:** ENG/OPS  
**Bağımlılık:** REL-001  
**Varsayılan karar:** Ayrı temiz beta D1

**Seçenek A — Önerilen**

1. Mevcut owner-only D1 export.
2. Ayrı beta D1 oluştur.
3. Güncel `0000` şemasını boş D1’e uygula.
4. 29 tablo/19 trigger/integrity/foreign-key kontrolü.
5. Candidate deployment’ı bu D1’e bağla.
6. Eski D1’i rollback için immutable sakla.

**Seçenek B — Veri korunacaksa**

- Gerçek `0001_campaign_loop_upgrade.sql` yaz.
- Eski schema fixture’ı oluştur.
- Governance/council/campaign/battle verisini yeni anahtarlara taşı.
- Forward ve rollback rehearsal çalıştır.

**Kabul**

- Değiştirilmiş ve önceden uygulanmış `0000` dosyasının uzaktan otomatik tekrar çalışacağı varsayılmaz.
- Zero duplicate season/front.
- `verify:migration`, `verify:runtime`, `verify:campaign` geçer.

**Kanıt:** D1 export hash’i, migration log’u, integrity çıktısı, rollback rehearsal.

---

### VIS-001 — Harita sahiplik token sistemi

**Owner:** DESIGN/ENG  
**Bağımlılık:** Yok  
**Dosyalar:** `db/world-bootstrap.ts`, game contracts/snapshot, `territorios-game.tsx`, `globals.css`

**Yapılacaklar**

- Beş tekrarlanan renk sistemini kaldır veya map semantics için kullanmayı bırak.
- Deterministic owner visual token üret.
- Komşu owner’larda yetersiz kontrastı önle.
- Viewer faction için ek outline/glow.
- Same-faction connected cluster için dış contour veya eşdeğer sınır.
- Origin, target, contested, selected state’i stroke/pattern/icon ile ayır.
- Renk tek bilgi kanalı olmasın.

**Kabul**

- Rastgele 20 ownership state testinde komşu farklı fraksiyonlar aynı state gibi görünmez.
- Grayscale ve en az deuteranopia simulation’da own/origin/target/contested/selected ayrılır.
- Owner adı aria-label ve province kartında bulunur.

**Kanıt:** 1440, 768, 390 ve grayscale screenshots + component tests.

---

### VIS-002 — Legend’ı gerçek state modeline bağla

**Owner:** DESIGN/ENG  
**Bağımlılık:** VIS-001  
**Dosyalar:** `territorios-game.tsx`, `messages.ts`, `globals.css`

**Yapılacaklar**

- `Casa del Mar`, `Liga Dorada` placeholder etiketlerini kaldır.
- Dinamik legend: viewer faction, other faction, origin, target/contested, selected.
- Görünmeyen state’i legend’da gösterme.
- Spanish/English eşleştir.

**Kabul**

- Legend’da map/data modelinde karşılığı olmayan kavram yok.
- Navy/slate gibi açıklanmamış raw palette kavramı kullanıcıya sunulmuyor.

---

### VIS-003 — Resource strip anlamını düzelt

**Owner:** PRODUCT/ENG  
**Bağımlılık:** Yok  
**Dosya:** `territorios-game.tsx`, contracts gerekirse snapshot projection

**Karar**

Aşağıdakilerden birini seç ve belgeye yaz:

- home province supply;
- faction aggregate/eligible supply;
- selected province supply + selected province label.

**Kabul**

- Düşman province seçildiğinde “faction resources” altında düşman supply’si görünmez.
- Aria-label ve visible label aynı anlamı taşır.
- Unit/component regression vardır.

---

### GP-001 — İlk destek eylemi impact feedback

**Owner:** PRODUCT/DESIGN/ENG  
**Bağımlılık:** Yok

**Yapılacaklar**

- Support success response’undan önce/sonra raw değerleri kullan.
- `+50`, old→new power, side, next tick göster.
- Pure domain helper ile bounded projected effect üret veya projection verilemiyorsa açıkça “next tick’e eklendi” anlat.
- Projection varsa `Tahmini` etiketi ve uncertainty/range.
- Real tick sonrası result state ile değiştir.
- Reduced-motion fallback.

**Kabul**

- Support action iki kez görünür debit yaratmaz.
- Feedback doğru battle route’a scoped olur.
- Kullanıcı başka front seçince eski success state görünmez.
- İnsan testinde impact comprehension ≥ %80.

---

### GP-002 — Cepheleri oyuncuya göre grupla ve öner

**Owner:** PRODUCT/ENG  
**Bağımlılık:** Contracts/snapshot mevcut viewer-side verisi

**Yapılacaklar**

- `My fronts` ve `Other fronts` grupları.
- İlk eligible front default.
- Attacker/defender badge.
- No active front state.
- Support CTA yalnız `canSupport` true ise.
- Battle selection map focus.

**Kabul**

- Joined attacker/defender doğru front ile açılır.
- Observer yanlış CTA görmez.
- 8-front fixture ve no-front fixture test edilir.
- Front comprehension ≥ %90.

---

### GP-003 — Beta cohort seeding ve odak province’ler

**Owner:** PRODUCT/QA/OPS  
**Bağımlılık:** İnsan test planı

**Yapılacaklar**

- 4–6 odak province seç.
- En az iki opposing front tanımla.
- Participant allocation matrix üret.
- Onboarding’de “beta için önerilen yoğun bölgeler” işareti.
- Coğrafi/kimlik doğrulaması isteme; seçim gönüllü.

**Kabul**

- En az iki fraksiyonda ≥2 oyuncu.
- En az iki saldırı/savunma tarafında aktif participant.
- Council/announcement/multiplayer görevleri yapılabilir.

---

### OPS-001 — Operator, privacy ve support minimum yüzeyi

**Owner:** PRIVACY/OPS  
**Bağımlılık:** Beta operator kararı

**Yapılacaklar**

- Operator/controller yasal adı.
- Support/privacy/security iletişimi.
- Amaçlar, hukuki dayanak, processors/transfers özeti.
- Retention ve deletion süreleri.
- Veri erişim/silme talep yolu.
- Participant consent metni.
- Cookie/auth açıklaması.
- Footer/pre-sign-in legal bağlantıları.

**Kabul**

- Katılımcı sign-in öncesi kısa privacy layer görür.
- İletişim adresleri gerçekten izlenir.
- Test raporu PII içermez.

---

### OPS-002 — Moderasyon ve incident sahipliği

**Owner:** MODERATION/OPS  
**Bağımlılık:** OPS-001

**Yapılacaklar**

- Named moderator/on-call.
- Report review SLA.
- Threat/doxxing/child-safety escalation.
- Appeal yolu.
- Read-only/disable switch prosedürü.
- Incident log template.

**Kabul**

- Test report’u oluştur, incele, karar ver ve kullanıcıya sonuç bildir akışı rehearsal edilir.
- P0 incident’te erişimi kapatma ve rollback prosedürü çalışır.

---

### OBS-001 — Kapalı beta metrics export

**Owner:** ENG/DATA/PRODUCT  
**Bağımlılık:** Event taxonomy freeze

**Yapılacaklar**

- Mevcut event/audit verisinden aggregate export script’i.
- Participant mapping random ID ile ayrı güvenli dosya.
- Activation, first action, front eligibility, votes, role action, share, D1/D7, errors, report ve battle participation.
- Null/small-cell suppression; e-posta/isim/user ID yok.
- Script disposable D1’de test edilir.

**Kabul**

- Tek komutla Markdown/CSV aggregate rapor üretir.
- Secret/PII scan temiz.
- Event denominator’ları belgelenir.

---

### QA-001 — Release screenshot ve visual regression seti

**Owner:** DESIGN/QA  
**Bağımlılık:** VIS/GP P0’ları

**Yapılacaklar**

- 12 zorunlu state/viewport screenshot.
- Baseline metadata: SHA, viewport, locale, user state, seed.
- Pixel diff threshold ve manual review.
- Grayscale/color-vision captures.

**Kabul**

- Blank/loading/wrong-state screenshot yok.
- 390/768/1440 core action görünür.
- Legend/nav overlap yok.

---

### QA-002 — Same-SHA automated release gates

**Owner:** ENG/QA  
**Bağımlılık:** Tüm P0 code işleri

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

**Kabul**

- 0 vulnerability.
- Coverage threshold geçer.
- 52 territory, 8 unique front, `combat-2.0.0`.
- 29 table, 19 trigger, integrity OK.
- 390 px no overflow.
- Axe initial/completed/store/legal 0 violation.
- Candidate SHA CI log’unda görünür.

---

### DEP-001 — Owner-only staging rollout ve rollback rehearsal

**Owner:** OPS/ENG  
**Bağımlılık:** DB-001, QA-002

**Yapılacaklar**

- D1 backup hash.
- Candidate deploy owner-only.
- Post-deploy anonymous/auth smoke.
- Join/support/role/council/report/share/locale test.
- Eight fronts and day 1 verify.
- Rollback artifact + D1 binding switch rehearsal.

**Kabul**

- P0 smoke yok.
- Rollback hedef süresi kaydedilmiş.
- Katılımcı erişimi smoke tamamlanmadan açılmaz.

## P1 — Final beta kalite görevleri

### VIS-004 — Province crest owner/state token

- Crest owner visual token’a bağlı.
- Contested/occupied/home için pattern/icon.
- Fixed coral kaldırılır.
- Component screenshot/regression.

### VIS-005 — Active front spatial markers

- Numbered origin/target markers.
- Selected front route arrow.
- Mobile yalnız relevant/selected markers.
- Marker map controlünü engellemez.

### GP-004 — Role category ve seasonal objective

- Role category badge.
- Metric location highlight.
- Small season objective.
- Role comprehension survey.

### GP-005 — Crown progress card

- Territory count, leader gap, phase, remaining time, last capture, next round.
- Symbolic/no-value açıklaması.

### UX-001 — Progressive disclosure

- Onboarding sırasında tek CTA.
- Store/replay/leaderboard ikincil.
- Advanced combat context details altında.
- Onboarding completion state kalıcı.

### A11Y-001 — Manual accessibility smoke

- Keyboard-only.
- 200% zoom.
- Screen reader desktop/mobile örnek oturum.
- Reduced motion.
- Color-only meaning kontrolü.
- Focus order ve live region noise.

### PERF-001 — Controlled load/soak

- 15-second polling ile 15, 50 ve 100 simulated viewer.
- D1 query/error/latency ölçümü.
- 429 ve catch-up reconciliation.
- 60-minute soak; duplicate event/front yok.

### SEC-001 — Deployed headers ve auth boundary

- CSP, HSTS/platform header, `frame-ancestors` kararı.
- Anonymous mutation 401/403.
- Spoofed auth headers external request ile etkisiz.
- Same-origin/idempotency/rate-limit.
- Error body PII/SQL/stack içermiyor.

## P2 — Beta sırasında ölçülecek veya sonraya bırakılacak

### GAME-001 — Bounded tactical message expansion

Yalnız gerçek katılımcılar mevcut vocabulary’yi yetersiz bulursa ekle. Serbest chat açma.

### GAME-002 — Capture motion polish

Kısa border sweep, result banner ve reduced-motion fallback. Eğlenceye etkisini ölç.

### RET-001 — Opt-in notification hypothesis

D1/D7 ve return reason kanıtı olmadan push/email ekleme.

### SOCIAL-001 — Province share card optimization

Share intent düşükse OG headline, urgency ve CTA varyantı test et. Spam/referral ödülü ekleme.

### ECON-001 — Monetization research only

Kapalı beta gerçek para kullanmaz. Fairness algısı, package dili ve misconception yalnız araştırılır; ödeme aktivasyonu ayrı release’tir.

## Çıkış kriteri

P0’ların tamamı `Done`, P1’lerin release için seçilen minimumları kapalı, QA-002 ve DEP-001 yeşil, ardından insan beta threshold’ları geçmişse `v0.2.0-beta.1` kapalı beta final adayıdır. Aksi halde NO-GO kalır.
