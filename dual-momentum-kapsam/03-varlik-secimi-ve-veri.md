# 03 — Varlık Seçimi, Veri Kaynakları ve Endeks/ETF Eşlemeleri

> Kaynak: Bölüm 5 ("Asset Selection"), Bölüm 6 ("Smart Beta"), Appendix B (veri metodolojisi).

---

## 1. Antonacci'nin Varlık Seçim Felsefesi

> *"We can maximize our return through intelligent asset choice. Risk premium can serve as a tailwind."*

Varlıkları **uzun-vade risk primine** göre sıralar (rüzgâr analojisi):

| Varlık | Reel getiri (uzun vade) | Antonacci'nin değeri | GEM'de? |
|--------|--------------------------|----------------------|---------|
| **ABD hisseleri** | ~%6.6–6.7 (200+ yıl) | "Güçlü rüzgâr" — çekirdek | ✅ Ana |
| **ABD-dışı hisseler** | ABD ile bonds arası | "İstikrarlı meltem" | ✅ Relative için |
| **Tahviller** | ~%3.6–3.8 | "Hafif esinti" | ✅ Güvenli liman |
| Emtia (commodities) | ~0 (uzun-only) | "Ters rüzgâr" | ❌ |
| Hedge fonları | ~0 alpha | "Girdap" | ❌ |
| Private equity | Değişken, yüksek fee | "Ters akıntı" | ❌ |
| Aktif yönetim | Negatif net | "Baş rüzgâr" | ❌ |

**Sonuç:** *"Low-cost equity and fixed-income index funds, appropriately selected by dual momentum, are all that one needs."*

---

## 2. NEDEN Sadece Hisse + Tahvil? (Diğerlerinin Elenme Gerekçeleri)

### 2.1 Tahvil — kalıcı değil, koşullu
- 1900–2013 ABD uzun devlet tahvili reel getiri sadece **%1.9** (hisse %6.5). 1940–1981 negatif reel getiri.
- Hisse-tahvil korelasyonu **1973'ten beri ~%70 zaman pozitif** → kalıcı çeşitlendirme güvenilir değil.
- **GEM yaklaşımı:** Tahvili sadece hisse zayıf + tahvil güçlüyken tut → "best of both worlds."
- **Risk parity eleştirisi:** %75+ tahvil + kaldıraç = düşük faiz ortamında riskli (kurtosis, likidite, karşı taraf, contagion riski). Bridgewater All Weather 2013 Q2'de −%8.4.

### 2.2 Emtia (Commodities) — varlık sınıfı bile değil
- **Zero-sum oyun:** Alıcı-satıcı kâr/zararı eşit. Beklenen pozitif getiri yok.
- **Roll yield çöktü:** 1969–1992 ortalama +%11/yıl; 2001'den beri **−%6.6/yıl**.
- **Front-running maliyeti:** ~%3.6/yıl (2000–2010).
- Korelasyon yükseldi: 2008 ve 1929 krizlerinde hisse-emtia korelasyonu **>%80** (tam ihtiyaç anında çeşitlendirme yok).

### 2.3 Hedge Fonları / Managed Futures / Private Equity
- Hedge fonları: 11 yıl üst üste 60/40 portföyün gerisinde. Net alpha ~0 veya negatif. Simon Lack: 1998–2010 yatırımcılar $308 milyar kaybetti, sektör $324 milyar fee aldı.
- Managed futures (CTA): 1994–2012 net excess return sadece %1.8/yıl (sıfırdan farksız), fee %4.3/yıl.
- Private equity: Fee'ler brüt getirinin ~%70'i.
- **Alternatif:** Hurst-Ooi-Pedersen (2014) — basit absolute momentum, CTA'ları before-cost eşleyebilir.

### 2.4 Aktif Fonlar
- 80%+ büyük-blend fon, 3/5/10/15 yıl benchmark'ın gerisinde.
- Ortalama aktif fon gider oranı %1.41 vs pasif %0.20.

---

## 3. Smart Beta Eleştirisi (Bölüm 6)

> *"The first problem with smart beta is that, like unicorns, there is no such thing."* (Beta akıllı/aptal olamaz; Morningstar "strategic beta" olarak yeniden adlandırdı.)

- **Fundamental indexing** = value tilt'li aktif yönetim; düşük maliyetli mid-cap value endeksiyle (örn. IWS) eşleşir.
- **Equal weight** = small/mid-cap tilt; yüksek turnover (devir), momentuma ters (kazananı satıp kaybedeni alır).
- **Low volatility / min variance** = yüksek turnover (%49) + sektör konsantrasyonu + tracking error.
- **Backtest tuzağı:** Yeni endeksler lansman öncesi 5 yıl piyasayı %10.3/yıl geçer, sonrası %1.0/yıl geride kalır (Vanguard "Joined at the Hip").

### Size ve Value primleri zayıfladı:
- **Size premium:** 1980'lerden beri istatistiksel olarak anlamsız (Israel-Moskowitz 2013, 86 yıl). Sadece illikit microcap'lerde.
- **Value premium:** Sadece en küçük hisselerde anlamlı; büyük-cap'te 4 alt-dönemin 3'ünde güvenilir değil. Fama-French 1963–1991 dönemi özel olabilir.
- **Momentum:** Tüm size gruplarında, her 20-yıl alt-döneminde **pozitif ve anlamlı**. 86 yıl: getiri %13.6, std 21.8, Sharpe **0.62** (value 0.47, size 0.44).

### Antonacci'nin smart beta değerlendirme kriterleri (5 soru):
1. Mantıklı mı? Altında kanıtlanmış kavram var mı?
2. Sağlam (robust) backtest — çoklu piyasa/dönemde tutarlı mı?
3. İşlem maliyeti + gider oranı düşük mü (azalan kârlara dayanır mı)?
4. Volatilite makul aralıkta mı?
5. Yeterli likidite var mı?

---

## 4. GEM VERİ SPESİFİKASYONU (kodlama için kritik)

### 4.1 Hisse Endeksleri

| Rol | Birincil endeks | Tarihsel zincir | Not |
|-----|-----------------|------------------|-----|
| ABD hisse | **S&P 500 Total Return** | — | Russell 3000 / MSCI US Broad ile ~aynı sonuç |
| ABD-dışı hisse | **MSCI ACWI ex-US** | 1988 Ocak öncesi → **MSCI World ex-US** | ACWI emerging içerir, World içermez |

> **"ACWI" GEM bağlamında** = 1988+ MSCI ACWI, öncesi MSCI World.
> ACWI bileşimi: %45 ABD, %45 diğer gelişmiş, %10 emerging. Emerging zaten ABD-dışı endekste (%14 ağırlık) → ayrıca eklenmez.

### 4.2 Tahvil ve Risksiz Faiz

| Rol | Endeks | Tarihsel zincir |
|-----|--------|------------------|
| Güvenli liman | **Barclays U.S. Aggregate Bond Index** (TR) | 1976 Ocak öncesi → **Barclays US Government & Credit** (yakın takip eder) |
| Risksiz faiz (eşik) | **90-günlük U.S. Treasury Bill** aylık getirisi | — |

> Aggregate Bond: ~%78 AAA, ort. vade <5 yıl, 1976'dan beri her hisse ayısında iyi dayandı.

### 4.3 Appendix B Genişletilmiş Varlık Evreni (absolute momentum testleri için)

Tüm aylık veri **Ocak 1973**'te başlar (aksi belirtilmedikçe), faiz+temettü dahil:

| Varlık | Endeks | Başlangıç |
|--------|--------|-----------|
| ABD hisse | MSCI US | 1973 |
| Yabancı hisse | MSCI EAFE | 1973 |
| Uzun Treasury | Barclays Long US Treasury | 1973 |
| Orta Treasury | Barclays Intermediate US Treasury | 1973 |
| Credit | Barclays US Credit | 1973 |
| High Yield | Barclays US High Yield Corporate | 1983 Tem |
| Gov't & Credit | Barclays US Gov't & Credit | 1973 |
| Aggregate | Barclays US Aggregate | 1976 Oca (öncesi Gov't&Credit) |
| T-Bill | 90-day US T-Bill | 1973 |
| REIT | FTSE NAREIT US Real Estate | 1973 |
| Emtia | S&P GSCI | 1973 |
| Altın | London PM gold fix (ay sonu) | 1973 |

### 4.4 İşlem Maliyeti Varsayımı
- Her T-Bill giriş/çıkış için **20 baz puan** düşülür (Appendix B).
- T-Bill geçiş sıklığı: REIT için 0.33/yıl, high-yield için 1.08/yıl.

---

## 5. ETF Eşlemeleri (Güncel — Uygulama İçin)

> Kitap 2014 tarihli; ETF sembolleri o günden. Güncel uygulamada kontrol edilmeli.

| Rol | Vanguard | iShares | SPDR/Diğer |
|-----|----------|---------|------------|
| ABD hisse (S&P 500) | **VOO** | IVV | SPY |
| ABD-dışı hisse | **VEU** (FTSE All-World ex-US) | IXUS / ACWX | — |
| Aggregate Bond | **BND** | AGG | — |
| T-Bill (eşik/park) | BIL (1-3ay T-Bill) | SHV | — |

- Ortalama gider oranı (Vanguard üçlüsü): ~**0.10%/yıl**.
- Komisyonsuz platformlar: Vanguard, Schwab, TD Ameritrade, Fidelity.

---

## 6. Veri Edinme Notları (İmplementasyon için)

- **Total return ZORUNLU** (price return DEĞİL). Temettü ve faiz dahil edilmeli — aksi halde absolute momentum eşiği yanlış olur.
- **Aylık (month-end) veri** yeterli — GEM aylık çalışır.
- Geçmiş endeks verisi: Bloomberg/Refinitiv ücretli; ücretsiz alternatif olarak ETF total return (yfinance "Adj Close") + tarihsel zincirleme proxy.
- **Tarihsel derinlik:** Kitap 1974–2013 kullandı. Daha kısa veri (örn. 15 yıl) **güvenilmez** (bkz. `07`, variance ratio / ergodicity tartışması).
