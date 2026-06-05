# 04 — Risk Ölçümü ve Değerlendirme Metrikleri

> Kaynak: Bölüm 7 ("Measuring and Managing Risk"), Appendix B. Backtest değerlendirme araç kutusu.

---

## 1. Sharpe Ratio (Reward-to-Variability)

**Formül:**
```
Sharpe = (Ortalama getiri − Risksiz getiri) / Getirinin standart sapması
       = (R_p − R_f) / σ_p
```

- Birim risk başına kazanılan getiri. Yüksek = daha iyi risk-ayarlı getiri.
- **Sharpe ≥ 1.0 = çok iyi.** (Ilmanen 2011: tek varlık trend-following 0–0.5; varlık portföyü 0.5–1.0.)
- t-istatistiği ile yakından ilişkili (anlamlılık testi).

**Uyarılar (kitapta belirtilen):**
- Serial correlation'a göre ayarlanmazsa yanıltıcı olabilir.
- "Sharpe of differences" > "differences in Sharpe" (variance error additive olduğu için).
- Upside ve downside volatiliteyi **eşit cezalandırır** (yukarı potansiyeli de cezalandırır).
- Antonacci iç çalışmalarında **skewness-adjusted Sharpe** kullanır; ama kitapta tanıdıklık için standart Sharpe.

### Sortino Ratio (alternatif)
- Sadece ortalama-altı (downside) volatiliteyi kullanır.
- **Dezavantaj:** Tüm upside volatilite bilgisini ve sağ kuyruğu atar (kâr fırsatı bilgisi kaybolur).

---

## 2. Maximum Drawdown (En Önemli Tail Risk Göstergesi)

**Tanım:**
> *"Drawdown is the percentage that price moves down from a new high. Maximum drawdown = the maximum cumulative peak-to-valley retracement on a month-end basis."*

```
Drawdown(t)     = (Değer(t) − En_yüksek_değer[0..t]) / En_yüksek_değer[0..t]
Max Drawdown    = min( Drawdown(t) )  tüm t için   (en negatif değer)
```

- GEM **ay-sonu** bazında hesaplar (intra-month değil).
- En sezgisel, anlaşılır, hesaplanması kolay tail-risk göstergesi.

**Uyarılar:**
- Track-record uzunluğuna bağımlı (uzun kayıt → büyük max DD). Sadece **aynı uzunlukta** geçmişe sahip stratejileri karşılaştırmak için uygun.
- Tek bir olayı temsil eder → drawdown'ların sayısı, derinliği, süresi de önemli (farklı zaman/koşullarda incelenmeli).

### Drawdown'un üç boyutu (Table 8.8 formatı):
- **Peak-to-Trough (ay):** Tepeden dibe süre.
- **Trough-to-Recovery (ay):** Dipten toparlanmaya süre.
- **Peak-to-Recovery (ay):** Toplam su-altı süresi.

---

## 3. Alpha (Faktör Modeli)

**Tanım:** Risk faktörleri çıkarıldıktan sonra kalan anormal getiri. Regresyon denkleminin kesişimi (intercept).

```
R_strateji − R_f = α + β_market·(R_m−R_f) + β_size·SMB + β_value·HML + β_mom·UMD + β_bond·BOND + ε
```

- **Fama-French-Carhart faktörleri:** Market, Size (SMB), Value (HML), Momentum (UMD).
- GEM için ek **Bond faktörü** (Barclays Aggregate excess return) — çünkü %30 zaman tahvilde.
- Kenneth French veri kütüphanesinden alınır.
- **t-istatistiği > ~2 → anlamlı.** Newey-West robust t-istatistikleri kullanılır (serial correlation/heteroskedasticity düzeltmesi).
- **Dezavantaj:** Drawdown'u (downside) ölçmez → tek başına yetersiz, drawdown ile tamamlanmalı.

---

## 4. Tail Risk ve Dağılım Özellikleri

### Skewness (çarpıklık)
- Hisse getirileri genelde **negatif skewed** (sol kuyruk uzun) → tail risk.
- **Pozitif skewness tercih edilir** (sürprizler lehe çalışır).

### Kurtosis / Fat tails / Leptokurtosis
- Finansal getiriler normal dağılım DEĞİL — fat tails (aşırı olaylar normalden sık).
- Mandelbrot: Cauchy / stable Paretian dağılımı; katastrofik düşüşler normal dağılımın öngördüğünden sık.

### CVaR (Conditional Value-at-Risk / Expected Shortfall)
- Kayıp olduğunda beklenen kaybı, gerçek getiri dağılımıyla hesaplar.
- **Antonacci kullanmıyor** — hesaplaması zor, sezgisel değil. Yerine **box plot** tercih ediyor.

---

## 5. Görsel Değerlendirme Araçları

### Box Plot (kutu grafiği)
- Tek grafikte: medyan getiri, interquartile range (IQR — getirilerin %75'i), beklenen ekstrem değerler.
- Rolling 12-aylık getiriler üzerinde reward-to-risk görünümü.

### Reward-to-Volatility Plot (Capital Market Line)
- X = getiri, Y = std sapma. Stratejileri konumlandırır.

### Rolling Returns / Rolling Drawdown
- 12-ay rolling getiri: ekstrem yukarı/aşağı yıllık getiri göstergesi.
- 5-yıl rolling max drawdown: zaman içinde risk profili.

### Quarterly Scatter (GEM vs ACWI)
- GEM çeyrek getirisi vs ACWI çeyrek getirisi. Sol-alt kadran: absolute momentum drawdown'u kırpar. Sağ-üst kadran: pozitif getiriler değişmeden geçer.

### Second-Order Stochastic Dominance
- Nonparametrik karşılaştırma: bir set diğerinden daha öngörülebilir (az riskli) VE en az o kadar yüksek ortalama getiriye sahipse tercih edilir.
- Cumulative distribution function (CDF) grafiği ile gösterilir.

---

## 6. İmplementasyon: Backtest Çıktı Metrik Seti

GEM/varyasyon backtest'i şunları üretmeli:

```
ZORUNLU METRİKLER:
  - Annual return (CAGR veya aritmetik — kitap aritmetik yıllık ortalama kullanır)
  - Annual std deviation
  - Annual Sharpe ratio  (R_f = T-Bill)
  - Maximum drawdown (month-end peak-to-valley)
  - % Profitable months

İLERİ METRİKLER:
  - Faktör regresyon alpha + t-stats (3/4/5 faktör)
  - Drawdown tablosu (en büyük 5: amount, start, low, recovery, süreler)
  - Decade-by-decade breakdown (robustluk)
  - Rolling 12-month return dağılımı (box plot verisi)
  - Up-market / down-market ayrımı (benchmark up/down yıllarında performans)
  - İşlem sayısı / yıl, varlık dağılım yüzdeleri (zaman %'si)

GÖRSELLER:
  - Log-scale cumulative growth (vs benchmark)
  - Reward-vs-volatility scatter
  - Rolling 5-year max drawdown
  - Quarterly scatter vs benchmark
  - CDF (stochastic dominance)
```

> **Not:** Kitap "Annual return" olarak büyük olasılıkla **aritmetik yıllık ortalama** kullanıyor (CAGR değil). İmplementasyonda hem aritmetik hem geometrik (CAGR) raporlanmalı; karşılaştırmalarda hangisinin kullanıldığı belirtilmeli.
