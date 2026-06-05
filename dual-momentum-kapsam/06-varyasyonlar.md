# 06 — Varyasyonlar ve Geliştirmeler (Mo' Better Momentum)

> Kaynak: Bölüm 9 ("Mo' Better Momentum"), Appendix B. GEM dışındaki modeller ve momentum geliştirme yöntemleri.

---

## ⚠️ Önce Uyarı: Momentumu "Geliştirme" Tehlikeleri

Antonacci Bölüm 9'a bir uyarıyla başlar — **karmaşıklık eklemek genelde zarar verir:**

1. **Multiple-comparisons hazard:** Yeterince strateji denersen, biri şans eseri iyi görünür. %5 anlamlılıkta 20 strateji denersen 1'i yanlış-pozitif çıkar.
2. **Overfitting:** Modeli geçmişe mükemmel uydurmak → geleceği kötü tahmin. López de Prado: "The better the backtested results, the worse the subsequent real-time results."
3. **Veri kıtlığı:** 15 yıl veri yetersiz. Variance ratio (VR) analizi: 1999–2013 mean-reverting, diğer 15-yıl dilimleri trending → kısa veriyle backtest güvenilmez. Piyasalar **nonergodic ve nonstationary.**
4. GEM'in üstünlüğü: 1801'e (relative) ve 1903'e (absolute) kadar out-of-sample doğrulama.

> **Sonuç:** GEM çoğu yatırımcı için yeterli. Aşağıdakiler "dikkatli" ele alınmalı.

---

## 1. Absolute Momentum Alternatif Trend Belirleme

### 1.1 Trend-line t-statistic (Baltas-Kosowski 2012)
- 12-ay günlük fiyatlara trend çizgisi fit et, eğimin t-istatistiğine bak.
- İşlem maliyetini ~2/3 azaltır. Sharpe before-cost ~aynı; emtia/sabit-getiri after-cost daha iyi.

### 1.2 Moving Averages (Hareketli Ortalamalar)
- **10-ay MA (= ~200-gün MA):** Fiyat MA üstündeyse long, altındaysa çık (Faber 2007).
- **12-ay MA:** Bazı uygulamacılar kullanır.
- Sonuç: 12-ay absolute momentum ≈ 10-ay MA ≈ 12-ay MA (bkz. `05`, Tablo 9.1).
- **Absolute momentum avantajı:** Daha az işlem (0.83/yıl vs MA 1.2/yıl).
- **Veri-mining uyarısı:** 200-gün/10-ay popülerliği muhtemelen çok sayıda MA uzunluğu test edilerek bulundu.
- **Mekanizma farkı:** Absolute momentum 2 zaman noktasını karşılaştırır (bugün vs 12 ay önce). MA gürültüyü düzleştirerek azaltır (Galton'un öküz-tartma noise-reduction analojisi).

### 1.3 Valuation Timing (CAPE) — Önerilmez
- Shiller CAPE (10-yıl döngüsel-ayarlı F/K).
- CAPE <10 → gelecek ~%20/yıl; CAPE >20 → ~%5/yıl.
- **Sorun:** 1996'da CAPE bugünküyle aynıyken çıkan, 2000'e kadar piyasanın 2 katına çıkmasını kaçırdı. Sadece kaba tahmin verir.

---

## 2. Relative Momentum Geliştirmeleri (Bireysel Hisseler İçin)

> Bunlar çoğunlukla **bireysel hisse** için; bazıları endekslere de uygulanabilir.

### 2.1 Proximity to 52-Week High (George-Hwang 2004)
- Mevcut fiyat / 52-hafta zirve oranı.
- 52-hafta zirveye yakınlık, geçmiş getirilerin öngörü gücünü **domine eder**.
- Hipotez: zirveye yakın hisseler = yakın zamanda iyi haber gelmiş.
- **Sadece hisselere** uygun (endeksler haber-duyarlı değil).

### 2.2 Price + Earnings + Revenue Momentum (Chen et al. 2014)
- Üçlü sort: fiyat + kazanç + gelir momentumu.
- Üçlü sort, ikili ve tekli sortları geçer. Fiyat momentumu en önemli (revenue+earnings sadece %19).
- **Sadece hisselere** uygun.

### 2.3 Accelerating Momentum (Chen-Yu 2013, Docherty-Hurst 2014)
- Günlük getiriyi zamanın karesine regrese et → fiyat eğrisi kavisi (curvature).
- Konveks (yukarı hızlanan) momentum > konkav momentum.
- "Trend salience": kısa-vade performansın 12-ay geometrik ortalamaya göre eğimi.
- **Endekslere ve diğer varlıklara da uygulanabilir.**

### 2.4 Fresh Momentum (Chen-Kadan-Kose 2009)
- "Fresh winner": son 12 ay güçlü AMA önceki 12 ay zayıf.
- "Stale winner": her iki dönemde güçlü.
- Fresh, stale'i ayda %0.43 geçer.
- **Endekslere ve diğer varlıklara da uygulanabilir.**

---

## 3. Global Balanced Momentum (GBM) — Antonacci'nin Modeli

**Tanım:** GEM 70 (muhafazakâr versiyon) üzerine kurulu, ama sabit-getiri kısmı da dual momentum ile seçilir.

```
GBM YAPISI:
  %70 → GEM ile aynı hisse holdingleri (S&P 500 / ACWI ex-US / bond)
  %30 → KALICI sabit-getiri, AMA dual momentum ile şunlardan seçilir:
        - Barclays US Long Treasury
        - BofA ML Global Government
        - BofA ML US Cash Pay High Yield
        - 90-day US T-Bill
```

> Hisse zayıfken hem %70'lik kısım hem %30'luk kısım, listeden en güçlü sabit-getiri enstrümanına gidebilir.

**Sonuç (1974–2013):** Getiri %16.04, Sharpe **0.98**, Max DD −16.83%. Geleneksel 60/40'a göre 2× Sharpe, yarı drawdown. (Tipik 60/40: 1900'den beri 11 on yılın 7'sinde enflasyonu zar zor geçti, −%66 ve −%55 drawdown'lar.)

---

## 4. Dual Momentum Sector Rotation (DMSR) — Antonacci'nin Favorisi

**Tanım:** ABD hisse sektörleri arasında rotasyon.

```
DMSR YAPISI:
  - Evren: Morningstar 11 ABD sektörü
    (technology, industrials, energy, communication services, real estate,
     financial services, consumer cyclical, basic materials, utilities,
     consumer defensive, healthcare)
  - RELATIVE: En güçlü sektörlerden eşit-ağırlıklı sepet seç (top-N)
  - ABSOLUTE: ABD piyasası downtrend'deyse → TÜM varlıklar Barclays US Aggregate Bond'a
  - Aylık rebalance (sektör eşit-ağırlık → mean reversion kârı yakalar)
```

**Sonuç (1993–2013):** Getiri %17.93, Sharpe **1.13** (en yüksek), Max DD −17.21%.

- **Gerekçe:** Moskowitz-Grinblatt (1999) — endüstri bileşenleri hisse momentum kârının ana kaynağı. Sektör momentumu, bireysel hisseden daha kolay uygulanır + düşük işlem maliyeti.
- DMSR market tepelerinden önce defensive sektörlere (consumer defensive, utilities) rotasyon yapabilir → absolute momentum devreye girene kadar koruma.
- Zaman dağılımı: %77 hisse, %23 tahvil.

> ⚠️ **Spec açığı:** Kitap "top-performing sectors" der ama **kaç sektör (top-N)** seçildiğini açıkça vermez. İmplementasyonda N bir parametre olmalı (örn. top 1, 3, 5). Bu, DMSR'nin tek belirsiz parametresi.

---

## 5. Kaldıraç ve Risk Parity (Appendix B)

### Leverage (kaldıraç)
- Absolute momentum drawdown'u kırptığı için kaldıraç daha güvenli olur.
- Borçlanma maliyeti: **fed funds + 25bp**.
- GEM 130: %30 kaldıraç (oran 1.30). Parity portföy örneği: 1.85:1 kaldıraç.

### Risk Parity + Absolute Momentum (Appendix B)
- Geleneksel risk parity: her varlığı volatilitenin tersiyle ağırlıkla → %70+ tahvil + kaldıraç.
- **Antonacci'nin basit parity'si:** MSCI US + Long Treasury + REIT + Credit + Gold, eşit-ağırlık (gold %20, bonds %40 çünkü 2× temsil).
- 12-ay absolute momentum overlay eklenince: risk parity sağlanırken sabit-getiri %40 ile sınırlı kalır, kaldıraç gereği azalır.
- **Second-order stochastic dominance:** Absolute momentum'lu parity, momentumsuza her zaman tercih edilir (daha yüksek ortalama + daha düşük risk).

---

## 6. Varyasyon Karşılaştırma Özeti

| Model | Dönem | Getiri | Sharpe | Max DD | Karmaşıklık | Açık parametre |
|-------|-------|--------|--------|--------|-------------|-----------------|
| **GEM** | 1974–2013 | 17.43 | 0.87 | −22.72 | En basit | look-back (12) |
| GBM | 1974–2013 | 16.04 | 0.98 | −16.83 | Orta | look-back + bond evreni |
| DMSR | 1993–2013 | 17.93 | 1.13 | −17.21 | Orta-yüksek | look-back + top-N sektör |
| GEM 70 | 1974–2013 | 14.52 | 0.90 | −15.46 | Basit | look-back |
| GEM 130 | 1974–2013 | 20.13 | 0.81 | −29.84 | Basit + kaldıraç | look-back + leverage |

> Antonacci'nin tavsiyesi: *"The simple GEM model… is a very good model for most investors."* Daha sofistike modeller (GBM, DMSR) onun şahsen kullandıkları ama çoğu yatırımcı için GEM yeterli.

> Güncel performans: optimalmomentum.com/performance.html (GEM, GBM, DMSR aylık güncellenir).
