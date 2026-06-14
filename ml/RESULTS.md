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
| +1 saat | **LSTM (DL)** | 0.534 | %56.2 | %56.3 |
| +2 saat | **LSTM (DL)** | 0.535 | %55.7 | %56.0 |

**DL ek testi:** PyTorch LSTM (24-bar ham getiri dizileri) de yönü çözemedi —
AUC ~0.53, doğruluk naive baseline'ı **geçemiyor**. Yani derin öğrenme de kısa-vade
yönü tahmin edemiyor. Karar kesinleşti: yön çıktısı kurulmayacak.

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
- **Yön + olasılık** çıktısı dürüst değil → kurmamalı (yanıltıcı). DL dahil kanıtlandı.
- **Oynaklık/hareket-büyüklüğü** tahmini dürüst ve kullanışlı → tahmin sayfası
  bunun üzerine kuruldu (kalibre: düşük/normal/yüksek oynaklık rejimi + beklenen aralık).

## Üretime alınan model (oynaklık)
`ml/train_volatility.py` → Ridge (aktarılabilir katsayılar) → `lib/models/volatility_60m_{1,2}.json`.
| Ufuk | Ridge OOS R² | ρ (Spearman) | naive (geçmiş vol) ρ |
|------|--------------|--------------|----------------------|
| +1 saat | 0.079 | 0.254 | 0.181 |
| +2 saat | 0.054 | 0.202 | 0.156 |

Rejim kalibrasyonu (OOS gerçek ort. |hareket|): +1s → düşük %0.33 · normal %0.42 · yüksek %0.62.
Web: `app/oynaklik` sayfası + `/api/volatility` (gün-içi 60m bar → `lib/volatility.ts` çıkarım).
