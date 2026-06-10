# 10 — Literatür & Kaynakça (Annotated Bibliography)

> **Amaç:** Antonacci'nin kitabı bu projenin çekirdek kaynağıdır; ancak momentum,
> trend-takibi ve kantitatif varlık dağılımı literatürü çok daha geniştir. Bu
> doküman, alanın **en iyi/kanonik kaynaklarını** kürasyonlu biçimde toplar ve
> her birini **saidterzi uygulamasına** bağlar. İki işe yarar:
>
> 1. **Entelektüel temel** — Uygulamadaki her yöntemin akademik/pratisyen dayanağını
>    açık eder (yöntemler "havadan" değil, literatürden gelir).
> 2. **Yol haritası** — Henüz uygulanmamış (⬜) ama değerli yöntemleri işaretler.

**saidterzi durumu lejantı:**
`✅ uygulandı` · `🟡 kısmen / dolaylı` · `⬜ henüz değil (aday)`

> Atıf biçimi: Yazar(lar) (Yıl), *Başlık*, Yayın yeri. — kitabın orijinal metni
> telifli olduğundan alıntılanmaz; yalnızca künye + kamuya açık özet/katkı verilir.

---

## 1. Çekirdek — Dual Momentum

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Antonacci, G. (2014)**, *Dual Momentum Investing*, McGraw-Hill | GEM modeli: göreceli (relative) + mutlak (absolute) momentumun birleşimi; T-Bill eşiği; aylık rebalans. Projenin temeli. | ✅ GEM çekirdeği, T-Bill mutlak eşik, sinyal `t`-sonu / getiri `t+1` |
| **Antonacci, G. (2016)**, *Risk Premia Harvesting Through Dual Momentum*, J. of Portfolio Mgmt (NAAIM 2012 Wagner Award) | Dual momentum'un risk-primi hasadı çerçevesi; çok-varlıklı genişleme. | 🟡 Çok-evrenli (8 evren) genişleme bu fikrin uzantısıdır |

**Not:** Antonacci'nin sitesi [optimalmomentum.com](https://optimalmomentum.com) — blog + güncel performans.

---

## 2. Momentum'un Keşfi — Göreceli (Cross-Sectional) Momentum

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Jegadeesh, N. & Titman, S. (1993)**, *Returns to Buying Winners and Selling Losers*, J. of Finance | Hisse momentumunun temel makalesi: 3–12 ay kazananları al, kaybedenleri sat → anlamlı getiri. | ✅ Hisse evreni göreceli momentum sıralaması (12-ay) |
| **Jegadeesh, N. & Titman, S. (2001)**, *Profitability of Momentum Strategies*, J. of Finance | Momentumun keşif sonrası da sürdüğünü (out-of-sample) gösterdi; davranışsal açıklama. | 🟡 Yarı-dönem tutarlılık (örneklem-dışı) kontrolü bu ruhu taşır |
| **Asness, C., Moskowitz, T. & Pedersen, L. (2013)**, *Value and Momentum Everywhere*, J. of Finance | Momentum (ve değer) sekiz varlık sınıfı/piyasada birlikte çalışır; ortak risk faktörleri. | ✅ Çok-evrenli mimari (hisse/sektör/bölge/emtia/faktör/tahvil) tam bu tezdir |

---

## 3. Zaman-Serisi / Trend (Absolute) Momentum

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Moskowitz, T., Ooi, Y.H. & Pedersen, L. (2012)**, *Time Series Momentum*, J. of Financial Economics | Bir varlığın kendi geçmiş getirisi geleceği öngörür (göreceli kıyas olmadan). Mutlak momentumun akademik temeli. | ✅ Mutlak momentum (excess vs T-Bill) tam budur |
| **Hurst, B., Ooi, Y.H. & Pedersen, L. (2017)**, *A Century of Evidence on Trend-Following Investing*, J. of Portfolio Mgmt | Trend-takibi 1880'den beri tüm varlık sınıflarında pozitif; kriz dönemlerinde "konveks" koruma. | ✅ Kriz Stres Testi paneli bu konveksliği gösterir |
| **Baltas, N. & Kosowski, R. (2013)**, *Momentum Strategies in Futures Markets and Trend-Following Funds* | Trend sinyalini OLS eğim **t-istatistiği** ile ölçme (gürültüye sağlam). | ✅ `trendTStat` (yöntem kartı) |

---

## 4. Çok-Varlıklı ve Faktör Momentumu

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Geczy, C. & Samonov, M. (2016)**, *Two Centuries of Price-Return Momentum*, Financial Analysts J. | 200+ yıllık çok-varlıklı momentum kanıtı → veri-madenciliği değil, kalıcı olgu. | 🟡 Sağlamlık argümanı (yarı-dönem + dayanıklılık haritası bunu yerel olarak test eder) |
| **Gupta, T. & Kelly, B. (2019)**, *Factor Momentum Everywhere*, J. of Portfolio Mgmt 45(3):13–36 | Faktörlerin kendisi momentum gösterir → "faktör momentumu". | ✅ **Faktör/Stil evreni** (MTUM/VLUE/QUAL/USMV/SIZE/VUG/HDV rotasyonu) |
| **Erb, C. & Harvey, C. (2006)**, *The Strategic and Tactical Value of Commodity Futures*, Financial Analysts J. | Emtia getirilerinde momentum/roll getirisi; düşük korelasyonlu çeşitlendirme. | ✅ **Emtia evreni** + çeşitlendirme vurgusu |

---

## 5. Taktik Varlık Dağılımı (Tactical Asset Allocation)

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Faber, M. (2007/2013)**, *A Quantitative Approach to Tactical Asset Allocation*, J. of Wealth Mgmt | 10-ay basit hareketli ortalama (SMA) ile piyasaya giriş/çıkış; basit kural, büyük drawdown azaltımı (GTAA / "Ivy"). | 🟡 MA-timing yöntem kartı (10/12-ay SMA); mutlak momentum benzer rolü oynar |
| **Gray, W. & Vogel, J. (2016)**, *Quantitative Momentum*, Wiley | Hisse momentum **seçimi**: "yol kalitesi" (smooth vs sıçramalı momentum), mevsimsellik, en güçlü momentum hisseleri. | ✅ Momentum panosunda **Kalite kolonu** (trailing 12-ay % pozitif ay) + 🟡 "hızlanan / taze-bayat / trend-salience" yöntem kartları |

---

## 6. Risk Yönetimi ve Momentum Çöküşleri

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Daniel, K. & Moskowitz, T. (2016)**, *Momentum Crashes*, J. of Financial Economics | Momentum nadiren ama şiddetli çöker (örn. 2009 dip-sonrası ralli); sol-kuyruk riski. | ✅ Kriz Stres Testi, CVaR, çarpıklık/basıklık, getiri histogramı bu kuyruk riskini ölçer |
| **Barroso, P. & Santa-Clara, P. (2015)**, *Momentum Has Its Moments*, J. of Financial Economics | Momentumu **oynaklığa göre ölçeklemek** (vol-targeting) Sharpe'ı belirgin artırır ve çöküşleri yumuşatır. | ✅ **Vol-Hedefli Versiyon paneli** (post-hoc, trailing-vol ölçekleme, ≤2× kaldıraç, lookahead'siz) |

---

## 7. Uygulama İncelikleri — "Rebalance Timing Luck" ve Ensemble

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Hoffstein, C., Faber, N. & Braun, S. (2019)**, *Rebalance Timing Luck*, J. of Index Investing 10(1) (Newfound Research) | Rebalans **gününün** seçimi başlı başına yıllık 100+ bps fark yaratabilir ("timing luck"). Çözüm: **örtüşen portföyler / tranching** (sermayeyi farklı günlerde rebalanslanan alt-portföylere böl → zamanda çeşitlendirme). | 🟡 **Çok-Pencereli Ensemble** uygulandı (fikrin look-back uyarlaması: {3,6,9,12} ay harmanı → parametre/timing luck söndürülür). Ay-içi ofsetli rebalans aylık veriyle uygulanamaz (alt-aylık veri gerekir). |

---

## 8. Eleştiri, Sağlamlık ve Örneklem-Dışı Kanıt

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Asness, C., Frazzini, A., Israel, R. & Moskowitz, T. (2014)**, *Fact, Fiction, and Momentum Investing*, J. of Portfolio Mgmt | Momentum hakkındaki 10 yaygın yanlış inancı kanıtla çürütür (işlem maliyeti, vergi, sadece short tarafı vb.). | 🟡 İşlem maliyeti modeli (stüdyo) + dürüst feragatname |
| **Grove, W. et al. (2000)**, *Clinical versus Mechanical Prediction* (meta-analiz) | 136 çalışma: kantitatif modeller uzman yargısını ~%94 yener → **modele disiplinli uy**. | 🟡 Şeffaf, kural-tabanlı motor; "modele uy" felsefesi (07. doküman) |
| **Schwert, G. (2003)**, *Anomalies and Market Efficiency* | Momentum, keşiften sonra kaybolmayan ender anomalilerden. | 🟡 Sağlamlık panelleri (dayanıklılık + yarı-dönem) |

---

## 9. Davranışsal ve Teorik Temel

| Kaynak | Katkı | saidterzi |
|--------|-------|-----------|
| **Barberis, N., Shleifer, A. & Vishny, R. (1998)**; **Daniel, Hirshleifer & Subrahmanyam (1998)**; **Hong & Stein (1999)** | Momentumun davranışsal modelleri: under-reaction (yavaş bilgi yayılımı) + over-reaction (aşırı güven/sürü). | 🟡 Kavramsal temel (02. doküman) "neden çalışır"ı açıklar |
| **Jegadeesh & Titman; Carhart (1997)** — momentum bir **risk faktörü** (WML / UMD) | Fama-French 3-faktöre eklenen momentum faktörü; alfa ölçümü için referans. | ✅ Fama-French alfa paneli (faktör beta + R²); Ken French verisi |

---

## 10. saidterzi Yol Haritası — Henüz Uygulanmamış (⬜) En Değerli Yöntemler

Literatür taraması, uygulamaya **gerçek değer katacak** ve henüz olmayan yöntemleri işaret eder:

1. ✅ **Çok-pencereli ensemble** (Hoffstein 2019 fikrinin look-back uyarlaması) — `runLookbackEnsemble` + 🪟 Çok-Pencereli Ensemble paneli. *Uygulandı (yol haritası #1).*
2. ✅ **Vol-hedefli ölçekleme** (Barroso–Santa-Clara 2015) — Vol-Hedefli Versiyon paneli. *Uygulandı (yol haritası #2).*
3. ✅ **"Yol kalitesi" momentum** (Gray–Vogel 2016) — momentum panosunda Kalite kolonu (trailing 12-ay % pozitif ay). *Uygulandı (yol haritası #3).*
4. ⬜ **Ay-içi ofsetli tranched rebalans** (Hoffstein 2019, tam biçim) — alt-aylık veri gerektirir; mevcut aylık veriyle uygulanamaz (veri kaynağı sınırı).

> **Durum:** Aylık veriyle uygulanabilir literatür-yöntemleri (#1–#3) tamamlandı.
> Kalan #4 alt-aylık veri gerektirir (gelecekte Stooq/günlük veri eklenirse açılır).

> Bu liste, gelecekteki geliştirme turlarının önceliklendirmesi için referanstır;
> her madde literatürde kanıtlanmış, uygulamaya doğrudan oturan bir yöntemdir.

---

## Atıf Notu

Tüm künyeler kamuya açık bibliyografik bilgidir. Telifli kitap/EPUB metni
(`.gitignore`) bu depoya dâhil değildir; yalnızca kendi sentezimiz ve künyeler
versiyonlanır (bkz. `00-INDEX.md` Telif Notu).
