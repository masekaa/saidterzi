# BIST intraday ML — baseline bulguları (dürüst, out-of-sample)

**Veri:** BIST 25 hisse, 60-dakikalık bar, ~2 yıl (2024-06 → 2026-06). ~108k ham bar,
~60k etiketli örnek. **Kronolojik split** (son %25 zaman = test; sızıntı yok).
Test dönemi ~2025-12 → 2026-06.

## 1) YÖN tahmini (artış / azalış) — **işe yaramıyor**
| Ufuk | Model | AUC | Doğruluk | Naive (hep çoğunluk) |
|------|-------|-----|----------|----------------------|
| +1 saat | LightGBM | 0.522 | %55.6 | **%56.4** |
| +1 saat | Lojistik | 0.519 | %56.2 | %56.4 |
| +2 saat | LightGBM | 0.512 | %55.9 | %56.2 |
| +2 saat | Lojistik | 0.519 | %56.0 | %56.2 |

**Sonuç:** AUC ≈ 0.51–0.52 (0.50 = tamamen rastgele). Model, "hep çoğunluğu söyle"
naive baseline'ını **geçemiyor**. Yani 1–2 saat sonrası **yön + olasılık** pratikte
**bir yazı-tura**. "%58 ihtimalle artış" gibi bir çıktı kullanıcıyı yanıltır.
(Akademik literatürle birebir uyumlu: kısa-vade yön tahmini ~rastgele.)

## 2) HAREKET BÜYÜKLÜĞÜ / oynaklık — **mütevazı ama GERÇEK sinyal var**
Hedef: önümüzdeki H barın |getiri| büyüklüğü (oynaklık).
| Ufuk | LightGBM OOS R² | sıra-korelasyon (Spearman) | naive (geçmiş vol) |
|------|-----------------|----------------------------|--------------------|
| +1 saat | 0.085 | 0.28 | 0.165 |
| +2 saat | 0.053 | 0.22 | 0.13 |

**Sonuç:** Hareketin *yönü* değil ama *büyüklüğü* tahmin edilebiliyor (oynaklık
kümelenmesi — iyi belgelenmiş etki). Model, basit "geçmiş oynaklık" baseline'ını
geçiyor (rho 0.28 vs 0.165). Risk zamanlaması için kullanışlı:
"önümüzdeki 1–2 saatte büyük/normal/küçük hareket beklenir".

## Karar
- **Yön + olasılık** çıktısı dürüst değil → kurmamalı (yanıltıcı).
- **Oynaklık/hareket-büyüklüğü** tahmini dürüst ve kullanışlı → tahmin sayfası
  bunun üzerine kurulmalı (kalibre: düşük/normal/yüksek oynaklık rejimi + beklenen
  aralık). İstenirse 5m veri / DL ile yön bir kez daha denenebilir ama beklenti aynı.
