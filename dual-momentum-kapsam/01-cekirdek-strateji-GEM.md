# 01 — Çekirdek Strateji: Global Equities Momentum (GEM)

> Kaynak: Bölüm 8 ("Global Equities Momentum"). Bu, kitabın sunduğu **ana, uygulanabilir model**.
> Bu dosya kodlanabilir netlikte yazılmıştır — her kural, parametre ve veri tanımı eksiksizdir.

---

## 1. GEM Nedir?

**GEM = Dual Momentum'un (Absolute + Relative) global hisse senedi piyasalarına uygulanmış hali.**

- *Relative momentum* ile ABD hissesi (S&P 500) ile ABD-dışı hisse (ACWI ex-US) arasında **en güçlü olanı seçer**.
- *Absolute momentum* ile seçilen hissenin trendi pozitif değilse **tahvile (Aggregate Bond) geçer**.
- Her ay yeniden değerlendirilir. Üç olası pozisyon: **S&P 500 / ACWI ex-US / Aggregate Bond** (her zaman %100 tek varlıkta).

Antonacci'nin tanımı: *"My name for this particular application of dual momentum is Global Equities Momentum (GEM). It truly is a gem."*

---

## 2. Varlık Evreni (Asset Universe)

GEM yalnızca **3 yapı taşı** kullanır:

| Rol | Endeks (kitapta kullanılan) | Açıklama |
|-----|------------------------------|----------|
| **ABD hissesi** | **S&P 500 Index** (total return) | Büyük-cap ABD. (Russell 3000 / MSCI US Broad Market ile sonuçlar "neredeyse aynı".) |
| **ABD-dışı hisse** | **ACWI ex-US** | MSCI ACWI'nin ABD-dışı kısmı. 1988 öncesi MSCI World ex-US kullanılır (aşağıya bak). |
| **Güvenli liman** | **Barclays U.S. Aggregate Bond Index** | Yüksek kaliteli (~%78 AAA), ortalama vade < 5 yıl, investment-grade. 1976'da başladı; her hisse ayı piyasasında iyi dayandı. |
| **Trend eşiği (kıyas)** | **90-günlük U.S. Treasury Bill** | Risksiz faiz. Absolute momentum eşiği olarak kullanılır. |

### ÖNEMLİ — Endeks tanımları ve tarihsel zincirleme:

- **"ACWI" terimi GEM'de:** 1988 Ocak'tan itibaren **MSCI ACWI**, 1988 öncesi **MSCI World**. (MSCI ACWI Ocak 1988'de başladı; emerging markets içerir. MSCI World emerging içermez.)
- MSCI ACWI bileşimi: ~%45 ABD + ~%45 diğer gelişmiş + ~%10 emerging.
- GEM, ACWI'yi iki "kabaca eşit" parçaya böler: **S&P 500** (ABD) ve **ACWI ex-US** (dünyanın geri kalanı).
- ABD hissesi için S&P 500 (large-cap) kullanılır → ABD-dışı endeksin de large/mid-cap olmasıyla **tutarlılık** için.

---

## 3. Tek Parametre: Look-Back (Formation) Period

- **Look-back = 12 ay.** Hem relative hem absolute momentum için aynı.
- Gerekçe: Akademik literatürün çoğunluğu 6–12 ay aralığını, en güçlü olarak **12 ayı** gösterir. 12 ay, aynı zamanda **portföy devir hızını ve işlem maliyetini minimize eder**.
- 12 ayın hem relative (Cowles-Jones 1937, Jegadeesh-Titman 1993) hem absolute (Moskowitz et al. 2012) momentumda en iyi olması → **çapraz doğrulama (cross-validation)**.
- **Skip-month YOK:** Bireysel hisselerde son 1 ay atlanır (kısa vadeli ters dönüş etkisini ayırmak için). GEM **endeks** kullandığından — gürültü, likidite ve mikroyapı sorunları az olduğundan — **son ay atlanmaz**.
- Robustluk: 3, 6, 9, 12 ay look-back'lerin hepsi ACWI'yi Sharpe ve drawdown'da geçer (bkz. `05`, GEM look-back tablosu).

### Look-back nasıl ölçülür (pratik)?

- "Son 12 aylık getiri" = **son 252 işlem günü (bir takvim yılı) toplam getirisi** (total return — temettü/faiz dahil).
- Antonacci'nin önerdiği pratik: StockCharts PerfCharts ile 252 gün performansını çizmek (çünkü total return kullanır; çoğu ücretsiz araç sadece fiyat değişimi kullanır → YANLIŞ olur).

---

## 4. GEM Karar Mantığı (Decision Logic)

### 4.1 Resmi Akış (kitaptaki Figure 8.4'ün mantığı)

```
HER AY SONU:

  r_US   = S&P 500'ün son 12 ay toplam getirisi
  r_INTL = ACWI ex-US'in son 12 ay toplam getirisi
  r_TBILL= 90-gün T-Bill'in son 12 ay getirisi   (absolute momentum eşiği)
  r_BOND = Aggregate Bond endeksi (pozisyon için, sinyalde kullanılmaz)

  ADIM 1 — RELATIVE MOMENTUM (aday seçimi):
      EĞER r_US >= r_INTL:  aday = S&P 500,     r_aday = r_US
      DEĞİLSE:              aday = ACWI ex-US,  r_aday = r_INTL

  ADIM 2 — ABSOLUTE MOMENTUM (trend filtresi):
      EĞER r_aday > r_TBILL:  pozisyon = aday        (%100 hisse)
      DEĞİLSE:                pozisyon = Aggregate Bond (%100 tahvil)

  Pozisyonu bir sonraki ay sonuna kadar tut.
```

### 4.2 Eşdeğer / Alternatif Formülasyon (Bölüm 8'de tarif edilen ikinci yol)

Kitapta iki yol da geçer; **sonuç aynıdır**:

> *"Each month we can apply absolute momentum to ACWI by switching between it and the Barclays U.S. Aggregate Bond Index based on whether the excess return of the **S&P 500** has been positive or negative during the past 12 months… We apply relative momentum… by selecting the stronger of its two components."*

Bu formülasyonda absolute momentum eşiği olarak **S&P 500'ün excess return'ü** (S&P 500 trendi) kullanılır — çünkü *"the United States leads world equity markets"* (Rapach, Strauss, Zhou 2013).

> ⚠️ **İmplementasyon notu:** İki formülasyon arasında ince bir fark var:
> - **Figure 8.4 yolu (ana):** Absolute momentum eşiği = **seçilen aday endeksin** kendi getirisi vs T-Bill.
> - **İkinci yol:** Absolute momentum eşiği = **her zaman S&P 500'ün** excess return'ü.
>
> Pratikte çoğu uygulama Figure 8.4 yolunu (aday endeksin kendi trendi) kullanır. Hangisinin kullanılacağı `09-implementasyon-spec.md`'de bir **konfigürasyon parametresi** olarak ele alınmalı. Kitabın akış şeması (Figure 8.4) "select better of two, then compare to T-bills" der → **varsayılan = aday endeksin kendi getirisi vs T-Bill**.

### 4.3 Sözel Özet

> "Geçen yıl S&P 500 mü yoksa yabancı hisse mi daha çok kazandırdıysa onu seç. Eğer o seçilen endeks T-Bill'i de geçtiyse ona yatır; geçmediyse (yani trend düşüşse) güvenli tahvile geç. Her ay tekrarla."

---

## 5. Rebalancing (Yeniden Dengeleme) Kuralları

- **Frekans:** Aylık (her ay sonu değerlendirme).
- **Holding period:** 1 ay.
- **Pozisyon büyüklüğü:** Her zaman %100 tek varlık (ağırlıklandırma yok — ya hep ya hiç).
- **İşlem sıklığı:** 1974–Ekim 2013 arası ortalama **yılda 1.35 geçiş** (switch). Çok düşük → işlem maliyeti ihmal edilebilir.
- **Zaman dağılımı (1974–2013):** S&P 500'de **%41**, ACWI ex-US'te **%29**, Aggregate Bond'da **%30**.

---

## 6. GEM Performansı (1974–2013, 40 yıl)

| Metrik | GEM | Relative Mom. | Absolute Mom. | ACWI | ACWI+Agg (70/30) |
|--------|-----|---------------|---------------|------|------------------|
| Yıllık getiri | **17.43%** | 14.41% | 12.66% | 8.85% | 8.59% |
| Yıllık std sapma | 12.64% | 16.20% | 11.93% | 15.56% | 11.37% |
| Yıllık Sharpe | **0.87** | 0.52 | 0.57 | 0.22 | 0.28 |
| Max drawdown | **−22.72%** | −53.06% | −23.76% | −60.21% | −45.74% |

**Yorum:** GEM, ACWI'ye göre yıllık getiriyi neredeyse **ikiye katlar**, volatiliteyi ~%2 düşürür, Sharpe'ı **dörde katlar**, max drawdown'u ~**2/3 azaltır**.

### On yıllık tutarlılık (robustluk göstergesi):

| Dönem | GEM Getiri | GEM Sharpe | GEM Max DD | ACWI Getiri | ACWI Max DD |
|-------|-----------|-----------|-----------|------------|------------|
| 1974–1983 | 15.95% | 0.54 | −10.95% | 9.23% | −32.78% |
| 1984–1993 | 22.39% | 0.97 | −22.72% | 14.23% | −27.02% |
| 1994–2003 | 17.87% | 1.02 | −15.37% | 5.91% | −56.52% |
| 2004–2013 | 13.68% | 0.96 | −18.98% | 6.15% | −60.21% |

> GEM her on yılda ACWI'den daha yüksek Sharpe ve daha düşük drawdown gösterir.

### GEM ne zaman üstün? (Önemli davranışsal beklenti)

- **S&P 500 düşüş yıllarında:** GEM 8/8 yılda S&P 500'ü geçti (down yıllarında ortalama GEM **+%2.2** vs S&P 500 **−%15.2**).
- **S&P 500 yükseliş yıllarında:** GEM 14 yıl üstün, 13 yıl geride, 5 yıl eşit. Yükseliş yıllarında ortalama GEM %21.9 vs S&P 500 %18.5.
- **Kritik uyarı:** GEM kısa vadede piyasayı her zaman geçmez — özellikle **dipten sert toparlanmalarda** (1975, 2002 sonu, 2009 başı) geride kalır (trend-following doğası gereği gecikir). Üstünlüğün çoğu **ayı piyasalarında** birikir.

### En büyük 5 GEM drawdown'u (vs ACWI):

| GEM DD | Başlangıç | Dip | Toparlanma | Tepe→Toparlanma (ay) |
|--------|-----------|-----|------------|----------------------|
| −22.7% | 9/87 | 10/87 | 5/89 | 20 |
| −19.0% | 11/07 | 10/08 | 12/10 | 35 |
| −16.1% | 5/11 | 9/11 | 2/12 | 9 |
| −15.4% | 7/98 | 8/98 | 11/98 | 4 |
| −8.6% | 4/00 | 7/00 | 7/01 | 15 |

> Karşılaştırma: ACWI'nin en büyük DD'si **−53.9%** (11/07 başlangıç, 62+ ayda hâlâ toparlanmamış).

---

## 7. Faktör Modeli Doğrulaması (Bölüm 8, Table 8.9)

GEM getirileri Fama-French-Carhart faktörlerine regrese edildiğinde (parantez içi = Newey-West robust t-istatistiği):

| Model | Alpha (yıllık) | Market | Size | Value | Momentum | Bond | R² |
|-------|----------------|--------|------|-------|----------|------|-----|
| 5-faktör | 5.30 (2.67) | 0.50 (8.32) | −0.06 (1.10) | 0.08 (1.32) | 0.20 (4.25) | 0.37 (3.50) | 0.44 |
| 4-faktör | 5.94 (2.99) | 0.53 (9.64) | −0.09 (1.83) | 0.09 (1.43) | 0.21 (4.39) | — | 0.44 |
| 3-faktör | 5.80 (3.25) | 0.47 (8.29) | — | — | 0.17 (5.00) | 0.39 (3.88) | 0.43 |

**Yorum:** Her üç modelde de GEM **ekonomik ve istatistiksel olarak anlamlı alpha** üretir. Momentum faktörü yüklemesi anlamlı (t=4.25–5.00) → relative strength momentum GEM'in performansında gerçekten rol oynuyor. (Alpha yıllıktır, t>2 anlamlı kabul edilir.)

---

## 8. Uygulama (How to Use It)

### ETF ile uygulama:
- **ABD hissesi ETF** (örn. Vanguard S&P 500 → VOO)
- **ABD-dışı hisse ETF** (örn. Vanguard FTSE All-World ex-US → VEU)
- **Tahvil ETF** (örn. Vanguard Total Bond → BND)
- **T-Bill** (eşik için — ETF tutmaya gerek yok, getiri kıyası için)

> Vanguard'ın bu üç ETF'inin ortalama yıllık gider oranı ~**10 baz puan**. Vanguard, Schwab, TD Ameritrade, Fidelity'de komisyonsuz ETF'lerle uygulanabilir.

### Pratik sinyal hesaplama:
- Her ay, üç ETF'in (ABD hisse, ABD-dışı hisse, T-Bill) **son 252 işlem günü total return** performansını çiz.
- İki hisse ETF'inden biri en yüksekse → o ay onu tut.
- T-Bill en yüksekse → trend düşüş demektir → Aggregate Bond ETF tut.

### Vergi avantajı:
- Dual momentum genelde **kaybeden pozisyonu satar** (kısa vadeli sermaye zararı yaratır) ve **kazanan pozisyonu tutar** (uzun vadeli sermaye kazancı) → doğal vergi verimliliği.

---

## 9. Farklı Risk Profillerine Uyarlama (Markowitz-Tobin Separation Theorem)

GEM tek bir "en yüksek Sharpe'lı portföy"dür. Risk iştahına göre:

| Versiyon | Tanım | Getiri | Std | Sharpe | Max DD | %Kârlı Ay |
|----------|-------|--------|-----|--------|--------|-----------|
| **GEM 130** (agresif) | GEM %30 kaldıraçlı (fed funds + 25bp ile borçlanma) | 20.13% | 16.43% | 0.81 | −29.84% | 65 |
| **GEM** (standart) | %100 GEM | 17.43% | 12.64% | 0.87 | −22.72% | 68 |
| **GEM 70** (muhafazakâr) | %70 GEM + %30 kalıcı Aggregate Bond | 14.52% | 9.50% | 0.90 | −15.46% | 69 |

> Muhafazakâr yatırımcı (emekli vb.) GEM'i kalıcı bir tahvil tahsisiyle harmanlayarak volatiliteyi düşürebilir; agresif yatırımcı kaldıraçla getiriyi artırabilir. *"A program for all seasons."*

---

## 10. Neden Basit? (Tasarım Felsefesi)

> *"GEM is simple and robust. It uses only U.S. equities, non-U.S. equities, and aggregate bonds. Its only parameter is a 12-month look-back period validated in hundreds of in- and out-of-sample momentum studies across many diverse markets and over two centuries of market data."*

- **Parsimonious** (tutumlu): Tek parametre, üç varlık.
- Overfitting/data-mining biası **minimumda** — çünkü 1801'e (relative) ve 1903'e (absolute) kadar out-of-sample doğrulama var.
- Einstein: *"Everything should be kept as simple as possible, but no simpler."*

---

## ✅ İmplementasyon Çekirdek Özeti (Kodlama için tek bakışta)

```
PARAMETRELER:
  lookback_months   = 12
  rebalance_freq    = "monthly" (month-end)
  position_sizing   = "all-in" (%100 tek varlık)
  skip_month        = False
  abs_mom_threshold = "candidate_self"  # veya "sp500_always" (konfigüre edilebilir)
  return_type       = "total_return"    # temettü/faiz dahil ZORUNLU

VARLIKLAR:
  US_EQUITY   : S&P 500 TR        (1988+ MSCI ACWI bileşimi ile tutarlı)
  INTL_EQUITY : ACWI ex-US        (1988 öncesi MSCI World ex-US)
  SAFE_BOND   : Barclays US Aggregate Bond (1976 öncesi US Gov't/Credit)
  TBILL       : 90-day US T-Bill  (eşik)

AYLIK ALGORITMA:
  1. r_us, r_intl, r_tbill = son 12 ay total return
  2. aday = (r_us >= r_intl) ? US_EQUITY : INTL_EQUITY
  3. pozisyon = (r_aday > r_tbill) ? aday : SAFE_BOND
  4. %100 pozisyona geç, ay sonuna kadar tut
```

Detaylı kod planı → `09-implementasyon-spec.md`
