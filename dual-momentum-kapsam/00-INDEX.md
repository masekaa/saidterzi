# Dual Momentum Investing — Kapsam Dokümanı (Master Index)

> **Kaynak Kitap:** *Dual Momentum Investing: An Innovative Strategy for Higher Returns with Lower Risk*
> **Yazar:** Gary Antonacci (McGraw-Hill, 2014/2015)
> **Doğrulama:** Orijinal EPUB (McGraw-Hill yayın kimliği `0071849459`, 2014-10-16 dosya tarihleri) tam metin olarak okundu ve işlendi.
> **Bu doküman:** Kitabın tüm teknik içeriğinin Türkçe (İngilizce terimli) kapsam dokümanı + kodlanabilir teknik spesifikasyon.

---

## 📌 Bu Doküman Ne İşe Yarar?

İki amaca birden hizmet eder:

1. **Referans arşivi** — Kitaptaki her teknik bilgiyi, kuralı, formülü, sayısal sonucu ve gerekçeyi kalıcı olarak saklar. İleride okumak, anlamak ve karar vermek için.
2. **Kodlama temeli (technical spec)** — GEM ve türev modellerini Python'da backtest edip uygulayacak netlikte kuralları, parametreleri ve edge-case'leri içerir.

---

## 🗂️ Dosya Haritası

| # | Dosya | İçerik | Öncelik |
|---|-------|--------|---------|
| 00 | `00-INDEX.md` | Bu dosya — genel harita, okuma rehberi | — |
| 01 | `01-cekirdek-strateji-GEM.md` | **GEM modelinin tam spesifikasyonu** — kurallar, karar ağacı, parametreler | ⭐ KRİTİK |
| 02 | `02-kavramsal-temeller.md` | Relative / Absolute / Dual momentum kavramları, neden çalışır | ⭐ KRİTİK |
| 03 | `03-varlik-secimi-ve-veri.md` | Varlık evreni, dahil/hariç gerekçeleri, endeks ve ETF eşlemeleri, veri kaynakları | Yüksek |
| 04 | `04-risk-ve-metrikler.md` | Sharpe, maximum drawdown, değerlendirme araçları, formüller | Yüksek |
| 05 | `05-backtest-sonuclari.md` | Tüm sayısal tablolar (kitaptan birebir) | Yüksek |
| 06 | `06-varyasyonlar.md` | GBM, DMSR, leverage/deleverage, momentum geliştirmeleri | Orta |
| 07 | `07-akademik-arkaplan.md` | MPT/CAPM/EMH eleştirisi, momentum tarihi, davranışsal temeller | Orta |
| 08 | `08-terimce.md` | Sözlük (TR + EN), tüm terimler | Referans |
| 09 | `09-implementasyon-spec.md` | **Python implementasyon planı** — pseudo-code, modül yapısı, edge-case'ler | ⭐ KRİTİK (kod) |
| 10 | `10-literatur-ve-kaynaklar.md` | **Annotated bibliography** — momentum/trend/kantitatif literatürün en iyi kaynakları, her biri uygulamaya bağlı (✅/🟡/⬜) + yol haritası | Referans |

---

## 📖 Kitabın Yapısı (Orijinal İçindekiler)

| Bölüm | Başlık (EN) | Türkçe | Bu dokümanda |
|-------|-------------|--------|--------------|
| Foreword | by Wesley R. Gray, PhD | Önsöz | 07 |
| Preface | — | Giriş | 07 |
| 1 | World's First Index Fund | Dünyanın İlk Endeks Fonu | 07 |
| 2 | What Goes Up… Stays Up | Yükselen Yükselmeye Devam Eder | 02, 07 |
| 3 | Modern Portfolio Theory Principles and Practices | MPT İlkeleri | 07 |
| 4 | Rational and Not-So-Rational Explanations of Momentum | Momentumun Açıklamaları | 02, 07 |
| 5 | Asset Selection: The Good, the Bad, and the Ugly | Varlık Seçimi | 03 |
| 6 | Smart Beta and Other Urban Legends | Smart Beta Efsaneleri | 03, 07 |
| 7 | Measuring and Managing Risk | Risk Ölçümü ve Yönetimi | 02, 04 |
| **8** | **Global Equities Momentum** | **GEM Modeli** | **01** (çekirdek) |
| 9 | Mo' Better Momentum | Daha İyi Momentum (varyasyonlar) | 06 |
| 10 | Final Thoughts | Son Sözler | 02, 07 |
| App. A | Global Equity Momentum Monthly Results | GEM Aylık Sonuçlar | (ham veri, _book/ops) |
| App. B | Absolute Momentum: A Simple Rule-Based Strategy… | Absolute Momentum Makalesi | 01, 04, 06 |
| — | Notes, Glossary, Bibliography, Recommended Reading, Index | — | 08 |

---

## ⚡ 30 Saniyede Çekirdek Strateji (GEM)

> Her ayın sonunda, son **12 aylık toplam getiriye** (total return, temettü dahil) bak:

```
1. S&P 500 (ABD hisse) son 12 ay getirisi > ACWI ex-US (ABD-dışı hisse) son 12 ay getirisi?
   → Daha güçlü olan "aday hisse endeksi" seçilir.

2. Seçilen aday endeksin son 12 ay getirisi > 90-günlük T-Bill (risksiz faiz) getirisi?
   ├─ EVET → %100 o hisse endeksine yatır
   └─ HAYIR → %100 Barclays U.S. Aggregate Bond (tahvil) endeksine geç

Her ay tekrarla. Yılda ortalama yalnızca ~1.35 işlem.
```

**40 yıllık sonuç (1974–2013):** Yıllık getiri **%17.43**, std sapma %12.64, Sharpe **0.87**, maksimum drawdown **−%22.72**. Karşılaştırma: ACWI %8.85 getiri, −%60.21 drawdown.

Detaylı spec için → `01-cekirdek-strateji-GEM.md`

---

## 🔑 Temel İlkeler (Kitabın Özü)

1. **Momentum = "premier anomaly"** (Fama & French). 1801'e kadar geriye giden, 40+ ülkede, 12+ varlık sınıfında çalışan en kalıcı piyasa anomalisi.
2. **İki momentum birleşir:**
   - *Relative momentum* → getiriyi artırır (en güçlü varlığı seçer).
   - *Absolute momentum* → riski azaltır (trend negatifse piyasadan çıkar). "Beat the market by avoiding the beatings."
3. **Basitlik = sağlamlık.** Tek parametre: 12-aylık look-back. Aşırı optimizasyon (overfitting) kırılganlık üretir.
4. **Yüksek risk primi olan varlığa yönel.** ABD hisseleri (uzun vadede ~%6.5-6.7 reel risk primi) çekirdek. Absolute momentum koruması sayesinde aşırı çeşitlendirmeye (deworsification) gerek kalmaz.
5. **Tahvil sadece gerektiğinde.** "We don't need no stinkin' bonds — except when dual momentum tells us we do."
6. **Disiplin > sezgi.** Grove et al. (2000): kantitatif modeller uzmanları vakaların %94'ünde yener. "Slavishly use the model" (Jim Simons).

---

## ⚠️ Bilinen Eleştiriler / Dikkat Noktaları (kitap-dışı, kapsam için not)

- **Whipsaw / kırılganlık:** Ay-sonu tek bakış tarihi ve tek 12-ay look-back, sinyal tarihine duyarlı (ThinkNewfound "Fragility Case Study"). → İmplementasyonda look-back ve rebalance-günü çeşitlendirmesi düşünülebilir (bkz. `09`).
- **Aylık sinyal gecikmesi:** Hızlı çöküşlerde (örn. 2020 Mart) geç çıkış riski.
- **1970'ler anomalisi:** Kısa vadeli faizin %20'ye çıktığı dönemde GEM, T-Bill'e takılıp kalabiliyor (kitap da kabul ediyor).

---

*Kaynak metinler `E:/invest/_txt/` altında bölüm bölüm (ch1.txt … ch10.txt, appb.txt, glossary.txt). Tablo görselleri `E:/invest/_book/ops/t*.jpg`.*
