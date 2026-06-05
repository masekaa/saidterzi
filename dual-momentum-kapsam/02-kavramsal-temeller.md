# 02 — Kavramsal Temeller: Momentum Türleri ve Neden Çalışır

> Kaynak: Bölüm 2, 4, 7 ve Appendix B. Stratejinin altında yatan tüm kavramlar.

---

## 1. Momentum Nedir?

> *"Momentum is the tendency of investments to persist in their performance. Investments that have done well will continue to do well, while those that have done poorly will continue to do poorly."*

- Newton'un 1. yasası analojisi: Hareket halindeki cisim hareketini sürdürme eğilimindedir.
- David Ricardo (1838): *"Cut your losses; let your profits run on."*
- **Pozitif serial correlation (otokorelasyon)** üzerine bir bahis: "A horse is easiest to ride in the direction it's already going."

---

## 2. Üç Momentum Türü

### 2.1 Relative Momentum (Göreceli / Relative Strength / Cross-Sectional)

- **Tanım:** Bir varlığın **diğer varlıklara göre** geçmiş performansı, gelecekteki göreceli performansını öngörür.
- Akademide genellikle **cross-sectional momentum** ile eşdeğer: varlık evrenini eşit dilimlere böl, en güçlü dilimi ("winners") al, en zayıfı ("losers") sat/elden çıkar.
- **İşlevi:** Getiriyi **artırır** (en güçlü varlığı seçer).
- **Zayıflığı:** Volatiliteyi ve drawdown'u **azaltmaz, hatta artırabilir** — çünkü seni her zaman *bir şeye* yatırımda tutar (ayı piyasasında "en az kötü" hisseye).
- Robert Levy (1967) "relative strength" terimini icat etti. Akademi sonradan "momentum" adını verdi.

### 2.2 Absolute Momentum (Mutlak / Time-Series / Longitudinal)

- **Tanım:** Bir varlığın **kendi geçmişine göre** performansı geleceğini öngörür. Moskowitz-Ooi-Pedersen (2012) buna **time-series momentum** dedi.
- **Formül:** Bir varlığın **excess return**'üne (getiri − T-Bill getirisi) bak:
  - Excess return > 0 → **pozitif absolute momentum** (long pozisyon tut)
  - Excess return < 0 → **negatif absolute momentum** (çık, güvenli limana geç)
- **Eşdeğeri:** "Absolute momentum, varlığı T-Bill ile eşleştirilmiş relative momentum gibidir."
- **İşlevi:** Hem getiriyi artırır **HEM DE** aşağı yön riskini (downside/drawdown) **dramatik azaltır** — ayı piyasalarında erken çıkış sağlar.
- **= Trend following.** *"Absolute momentum is quintessential trend following."* Hedef: Buffett'ın 1. kuralı — "para kaybetme". *"Beat the market by avoiding the beatings."*
- **Esneklik avantajı:** Tek bir varlığa bile uygulanabilir (relative için ≥2 varlık gerekir). Tüm varlıkları tutmaya devam edebilirsin (trendi pozitif kaldıkça) → daha fazla çeşitlendirme, daha düşük kısa-vade volatilite.

### 2.3 Dual Momentum (İkili = Absolute + Relative)

- **Tanım:** İkisinin birleşimi. Her ikisinin avantajlarını alır.
- **Sıralama (kritik):**
  1. **Önce relative momentum** → son 12 ayın en iyi performans gösteren varlığını seç.
  2. **Sonra absolute momentum** → seçilen varlığın excess return'ü pozitif mi? Pozitifse o varlığa yatır; negatifse kısa-orta vadeli sabit getiriye (tahvil) geç.
- *"This way, we are always in harmony with the trend of the market. Go market!"*

### Momentum Türleri Karşılaştırma Tablosu

| Özellik | Relative | Absolute | Dual |
|---------|----------|----------|------|
| Getiriyi artırır | ✅ | ✅ | ✅ |
| Drawdown azaltır | ❌ (artırabilir) | ✅✅ | ✅✅ |
| Min. varlık sayısı | 2 | 1 | 2 |
| Trend filtresi | ❌ | ✅ | ✅ |
| Ayı piyasası koruması | ❌ | ✅ | ✅ |

> Relative ve absolute momentum aylık getiri korelasyonu = **0.69** → birbirini tamamlarlar (diversification value). Absolute, ayı yıllarında (1982, 2001, 2008) değer katar; relative, boğa yıllarında (1986–2000, 2003–2007) değer katar.

---

## 3. Look-Back (Formation) Period Bilimi

- **En iyi aralık:** 6–12 ay, **12 ayda kümeleniyor.**
- Absolute momentum için Moskowitz et al. (2012): 1–48 ay arasından **12 ay en yüksek istatistiksel anlamlılığa** sahip (1 ay holding ile).
- Appendix B'de Antonacci 8 varlık × 2–18 ay look-back Sharpe testi yaptı → en iyiler **12 ayda kümeleniyor** (bkz. `05`, formation period tablosu).
- **Skip-month:** Bireysel hisselerde son 1 hafta/ay atlanır (kısa vade reversal etkisi için). **Endekslerde atlanmaz** (gürültü/likidite sorunu yok).

---

## 4. Neden Momentum Çalışır? (Bölüm 4)

İki okul: **rasyonel (risk-temelli)** ve **davranışsal**. Antonacci davranışsalı daha ikna edici buluyor.

### 4.1 Rasyonel (Risk-Temelli) Açıklamalar — Zayıf

- Momentum kârı, keşfedilmemiş risk faktörleri için tazminat olabilir.
- Denenen faktörler: makroekonomik değişkenler, growth shocks, likidite, consumption risk, endüstri faktörleri.
- **Sorun:** Griffin-Ji-Martin (2003), Avramov-Chordia (2006) bunların momentumu açıklamadığını gösterdi. Size ve value gibi bilinen faktörler de açıklamıyor.

### 4.2 Davranışsal Açıklamalar — Güçlü

Kahneman-Tversky **Prospect Theory** (1979) temelinde. Temel biaslar:

| Bias | Etki | Momentuma katkısı |
|------|------|-------------------|
| **Anchoring** (çıpalama) | İlk bilgiye aşırı ağırlık, yeni bilgiye yavaş tepki | **Underreaction** → fiyat fair value'nun altında kalır, sonra yetişir |
| **Confirmation bias** | Görüşü doğrulayan bilgiye ağırlık | Trendleri pekiştirir |
| **Herding / feedback trading** | Sürü davranışı; alış alışı doğurur (Soros "reflexivity") | **Overreaction** → fiyat fair value'yu aşar |
| **Conservatism + Representativeness** | Önce yavaş güncelle, sonra yanlış paralellik kur | Underreaction sonra overreaction |
| **Overconfidence + self-attribution** | Başarıyı kendine, başarısızlığı şansa yor | Fiyatları iter, trend sürer |
| **Slow diffusion of information** | Haberin yavaş yayılması / yatırımcı dikkatsizliği | 6–12 ayda fiyat yetişir |
| **Disposition effect** | Kazananı erken sat, kaybedeni tut | Fiyatın fair value'ya gidişini geciktirir → momentum |

### Birleşik Davranışsal Model:

> **Underreaction (kısa vade) → gecikmeli Overreaction (uzun vade).**
> Anchoring + disposition effect + confirmation bias → başlangıçta yetersiz tepki (fiyat geride kalır).
> Herding + bandwagon → sonradan aşırı tepki (fiyat hedefi aşar).

- **Fizyoloji:** Herding oksitosin (güven) ile, izolasyon amygdala (savaş-kaç) ile bağlantılı. Kandasamy et al. (2014): volatilite artınca kortizol artar → yatırımcı daha riskten kaçar → diplerde sürü halinde satar.
- **Önemli sonuç:** Bu biaslar **DNA'da ve beyin kimyasında** gömülü → değişmesi olası değil → **momentum gelecekte de çalışmaya devam edecek.**
- Richard Thaler: EMH vs davranışsal finans seçimi = *"precisely wrong or vaguely right"* arasında seçim.

---

## 5. Momentumun Kalıcılığı (Tarihsel Kanıt)

- **Cowles & Jones (1937):** İlk bilimsel momentum çalışması. 1920–1935, en güçlü hisseler güçlü kalmaya devam etti.
- **Jegadeesh & Titman (1993):** Seminal makale. 1965–1989, son 6–12 ay kazananları, sonraki 6–12 ayda kaybedenleri **ayda ~%1** geçti. (2001'de 1990–1998 ile out-of-sample doğrulandı — yine ~%1/ay.)
- **Geczy & Samonov (2012):** Momentum **1801'e** kadar çalışıyor (212 yıl). Üst 1/3 vs alt 1/3 → ayda %0.4, t-istatistiği **5.7**.
- **Chabot-Ghysels-Jagannathan (2009):** Viktorya dönemi İngiltere'sinde çalışıyor.
- **Schwert (1993):** Value, size, calendar gibi anomaliler keşiften sonra zayıfladı/kayboldu; **sadece momentum kalıcı oldu.**
- **300+ akademik makale** (son 5 yılda 150+). 40+ ülke, 12+ varlık sınıfı: ABD/yabancı hisse, endüstri grupları, endeksler, devlet/şirket tahvilleri, emtia, döviz, konut.
- **Fama & French:** Momentum = *"premier anomaly"* / *"center stage anomaly."* Bilinen risk faktörleriyle açıklanamıyor.

---

## 6. Risk Yönetimi Bağlamı (Bölüm 7)

### Yatırımcı davranış açığı (behavior gap):
- 30 yıl (→2013): S&P 500 %11.1/yıl, ortalama hisse fonu yatırımcısı sadece **%3.69**. ~%1.4 fon gideri, ~%6 kötü zamanlama.
- CGM Focus örneği: 2000–2010 en yüksek getirili fon (%18.2/yıl), ama tipik yatırımcı **−%10** kaybetti (tepede aldı, dipte sattı).
- **Çözüm:** Modest volatiliteli, disiplinli, kurallı yaklaşım → duygusal çıkışları önler.

### Absolute momentum'un risk değeri:
- Moskowitz et al. (2012): 58 varlığın hepsinde absolute momentum pozitif kâr. Sharpe > 1 (non-momentum'un ~2.5 katı). Aşırı olaylarda en yüksek getiri → **hedge işlevi**.
- Hurst-Ooi-Pedersen (2012): 1903'e kadar tutarlı kârlı. S&P 500 ve 10-yıl Treasury'ye korelasyon yalnızca **−0.05** (1903–2011).

---

## 7. Kilit Alıntılar (Felsefe)

- *"Absolute momentum aims to beat the market by avoiding the beatings."*
- *"The most important rule in trading is: play great defense, not great offense."* — Paul Tudor Jones
- *"In today's environment of high investment volatility (HIV), those who are investment active should… always practice safe investing."*
- *"Models beat experts 94% of the time."* — Grove et al. (2000)
- *"So if you're going to trade using models, you should just slavishly use the models."* — Jim Simons
