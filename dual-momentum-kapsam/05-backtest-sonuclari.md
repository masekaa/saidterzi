# 05 — Backtest Sonuçları (Kitaptan Birebir Tüm Tablolar)

> Tüm sayısal değerler kitabın orijinal tablo görsellerinden (`_book/ops/t*.jpg`) okunmuştur.
> Bunlar **doğrulama hedefleri** — kendi backtest'imiz bu rakamlara yakın çıkmalı (veri/zincirleme farkları nedeniyle birebir olmayabilir).

---

## Tablo 8.1 — S&P 500 Absolute Momentum (1974–2013)

| | Yıllık Getiri | Yıllık Std | Sharpe | Max Drawdown | %Kârlı Ay |
|--|---------------|------------|--------|--------------|-----------|
| S&P 500 Index | 12.34 | 15.59 | 0.42 | −50.95 | 62 |
| Aggregate bond | 7.99 | 5.58 | 0.46 | −12.74 | 69 |
| S&P 500 + agg bond (70/30) | 11.01 | 11.45 | 0.47 | −37.62 | 64 |
| **S&P 500 absolute momentum** | **14.38** | **12.23** | **0.69** | **−29.58** | **66** |

> Sadece absolute momentum eklemek: getiri +200bp, std −3%, max DD %50→%30.

---

## Tablo 8.2/8.3 — ACWI ve Momentum (1974–2013)

| | Yıllık Getiri | Yıllık Std | Sharpe | Max Drawdown | %Kârlı Ay |
|--|---------------|------------|--------|--------------|-----------|
| ACWI | 8.85 | 15.56 | 0.22 | −60.21 | 61 |
| Relative momentum | 14.41 | 16.20 | 0.52 | −53.06 | 63 |
| Absolute momentum | 12.66 | 11.93 | 0.57 | −23.76 | 66 |

> Relative: +556bp getiri ama hafif daha yüksek volatilite. Absolute: +381bp getiri, −3.6% std, max DD %60'tan 2/3 azalma.

---

## Tablo 8.4 — Momentum Performance by Decade (1974–2013) ⭐ ANA TABLO

| Metrik | GEM | Relative Mom | Absolute Mom | ACWI | ACWI+AGG (70/30) |
|--------|-----|--------------|--------------|------|-------------------|
| **TÜM VERİ** | | | | | |
| Yıllık getiri | **17.43** | 14.41 | 12.66 | 8.85 | 8.59 |
| Yıllık std | 12.64 | 16.20 | 11.93 | 15.56 | 11.37 |
| Sharpe | **0.87** | 0.52 | 0.57 | 0.22 | 0.28 |
| Max DD | **−22.72** | −53.06 | −23.76 | −60.21 | −45.74 |
| **1974–1983** | | | | | |
| Yıllık getiri | 15.95 | 15.41 | 12.46 | 9.23 | 8.98 |
| Yıllık std | 11.77 | 16.39 | 10.83 | 13.95 | 11.04 |
| Sharpe | 0.54 | 0.36 | 0.30 | 0.02 | 0.00 |
| Max DD | −10.95 | −32.77 | −11.91 | −32.78 | −25.37 |
| **1984–1993** | | | | | |
| Yıllık getiri | 22.39 | 20.58 | 16.03 | 14.23 | 13.62 |
| Yıllık std | 14.60 | 16.68 | 13.54 | 15.66 | 11.45 |
| Sharpe | 0.97 | 0.75 | 0.64 | 0.46 | 0.57 |
| Max DD | −22.72 | −22.72 | −23.76 | −27.02 | −18.56 |
| **1994–2003** *(kitapta "1994–1903" basım hatası)* | | | | | |
| Yıllık getiri | 17.87 | 10.73 | 12.46 | 5.91 | 6.24 |
| Yıllık std | 12.21 | 16.11 | 11.45 | 15.22 | 10.66 |
| Sharpe | 1.02 | 0.38 | 0.67 | 0.11 | 0.18 |
| Max DD | −15.37 | −48.85 | −16.43 | −56.52 | −33.32 |
| **2004–2013** | | | | | |
| Yıllık getiri | 13.68 | 11.69 | 9.78 | 6.15 | 5.69 |
| Yıllık std | 11.83 | 15.68 | 11.85 | 17.31 | 12.27 |
| Sharpe | 0.96 | 0.58 | 0.53 | 0.26 | 0.33 |
| Max DD | −18.98 | −53.06 | −21.69 | −60.21 | −45.74 |

*AGG sütunu = %70 ACWI + %30 aggregate bond.*

---

## Tablo 8.5 — GEM Look-Back Period Robustluk (1974–2013)

| | GEM12 | GEM9 | GEM6 | GEM3 | ACWI |
|--|-------|------|------|------|------|
| Yıllık getiri | 17.43 | 15.85 | 14.37 | 13.90 | 8.85 |
| Yıllık std | 12.64 | 12.39 | 11.84 | 12.04 | 15.56 |
| Sharpe | 0.87 | 0.78 | 0.71 | 0.65 | 0.22 |
| Max DD | −22.72 | −18.98 | −23.51 | −23.26 | −60.21 |

> Tüm look-back'ler ACWI'yi Sharpe ve drawdown'da geçer. 12 ay en yüksek Sharpe.

---

## Tablo 8.6 — GEM Outperformance Yılları (1974–2013)

| | S&P 500 Yükseliş Yılı | S&P 500 Düşüş Yılı |
|--|------------------------|---------------------|
| GEM > S&P 500 | 14 | **8** |
| S&P 500 > GEM | 13 | 0 |
| GEM = S&P 500 | 5 | 0 |

## Tablo 8.7 — Ortalama Yıllık Getiri (up/down)

| | S&P 500 Yükseliş Yılı | S&P 500 Düşüş Yılı |
|--|------------------------|---------------------|
| GEM | 21.9 | **+2.2** |
| S&P 500 | 18.5 | **−15.2** |

> GEM düşüş yıllarının HEPSİNDE S&P 500'ü geçti ve ortalama pozitif kaldı.

---

## Tablo 8.8 — En Büyük 5 Drawdown (GEM vs ACWI)

| | DD% | Başlangıç | Dip | Toparlanma | P→T ay | T→R ay | P→R ay |
|--|-----|-----------|-----|------------|--------|--------|--------|
| **GEM** | −22.7 | 9/87 | 10/87 | 5/89 | 1 | 19 | 20 |
| | −19.0 | 11/07 | 10/08 | 12/10 | 11 | 24 | 35 |
| | −16.1 | 5/11 | 9/11 | 2/12 | 4 | 5 | 9 |
| | −15.4 | 7/98 | 8/98 | 11/98 | 1 | 3 | 4 |
| | −8.6 | 4/00 | 7/00 | 7/01 | 3 | 12 | 15 |
| **ACWI** | −53.9 | 11/07 | 2/09 | ? | 16 | >46 | >62 |
| | −50.5 | 3/00 | 3/03 | 10/06 | 30 | 49 | 79 |
| | −30.8 | 3/74 | 9/74 | 3/76 | 7 | 18 | 25 |
| | −27.0 | 12/89 | 9/90 | 12/93 | 9 | 48 | 57 |
| | −20.4 | 8/87 | 11/87 | 1/89 | 3 | 14 | 17 |

---

## Tablo 8.9 — Faktör Pricing Modelleri (1974–2013)

| Model | Alpha* | Market | Size | Value | Momentum | Bond | R² |
|-------|--------|--------|------|-------|----------|------|-----|
| 5-faktör | 5.30 (2.67) | 0.50 (8.32) | −0.06 (1.10) | 0.08 (1.32) | 0.20 (4.25) | 0.37 (3.50) | 0.44 |
| 4-faktör | 5.94 (2.99) | 0.53 (9.64) | −0.09 (1.83) | 0.09 (1.43) | 0.21 (4.39) | — | 0.44 |
| 3-faktör | 5.80 (3.25) | 0.47 (8.29) | — | — | 0.17 (5.00) | 0.39 (3.88) | 0.43 |

*Alpha yıllıktır. Parantez içi = Newey-West robust t-istatistiği.*

---

## Tablo 8.10 — Leveraged/Deleveraged GEM (1974–2013)

| | Yıllık Getiri | Yıllık Std | Sharpe | Max DD | %Kârlı Ay |
|--|---------------|------------|--------|--------|-----------|
| GEM 130 (%30 kaldıraçlı) | 20.13 | 16.43 | 0.81 | −29.84 | 65 |
| GEM (standart) | 17.43 | 12.64 | 0.87 | −22.72 | 68 |
| GEM 70 (%70 GEM + %30 tahvil) | 14.52 | 9.50 | 0.90 | −15.46 | 69 |

---

## Tablo 9.1 — Absolute Momentum vs Moving Averages (S&P 500, 1974–2013)

| | 12-ay Abs Mom | 10-ay MA | 12-ay MA | S&P 500 (filtresiz) |
|--|---------------|----------|----------|----------------------|
| Yıllık getiri | 14.38 | 14.16 | 14.29 | 12.34 |
| Yıllık std | 12.23 | 12.13 | 12.23 | 15.59 |
| Sharpe | 0.69 | 0.68 | 0.68 | 0.42 |
| Max DD | −29.58 | −23.26 | −23.26 | −50.95 |

> Üçü de benzer. Abs Mom: %70 zaman hissede, 31 işlem/40 yıl (0.83/yıl). 10-ay MA: %74 zaman, 49 işlem (1.2/yıl) → abs mom daha düşük işlem maliyeti.

---

## Tablo 9.2 — AQR Momentum vs Russell 1000 + Abs Mom (1980–2013)

| | AQR Momentum | Russell 1000 | Russell 1000 + Abs Mom |
|--|--------------|--------------|-------------------------|
| Yıllık getiri | 15.14 | 13.09 | **15.92** |
| Yıllık std | 18.27 | 15.51 | **12.57** |
| Sharpe | 0.51 | 0.49 | **0.80** |
| Max DD | −51.02 | −51.13 | **−23.41** |

> Bireysel hisse momentum yerine basit endeks + absolute momentum daha üstün. (AQR'ın %0.7/yıl işlem maliyeti tabloda yok.)

---

## Tablo 9.4 — Global Balanced Momentum (GBM) (1974–2013)

| | GBM | 70% GEM + 30% Agg | 70% ACWI + 30% Agg | 60% S&P + 40% Agg |
|--|-----|--------------------|---------------------|--------------------|
| Yıllık getiri | 16.04 | 14.52 | 8.59 | 10.58 |
| Yıllık std | 10.06 | 9.50 | 11.37 | 10.15 |
| Sharpe | **0.98** | 0.90 | 0.28 | 0.49 |
| Max DD | −16.83 | −15.46 | −45.74 | −32.54 |

> GBM, 60/40'a göre 2× Sharpe, yarı max drawdown.

---

## Tablo 9.5 — Dual Momentum Sector Rotation (DMSR) (1993–2013)

| | DMSR | S&P 500 | Sector Equal Weight | EW + Agg (77/23) |
|--|------|---------|----------------------|-------------------|
| Yıllık getiri | 17.93 | 10.49 | 11.45 | 10.17 |
| Yıllık std | 12.24 | 14.91 | 13.36 | 10.39 |
| Sharpe | **1.13** | 0.48 | 0.60 | 0.66 |
| Max DD | −17.21 | −50.95 | −47.50 | −37.83 |

> DMSR en yüksek Sharpe'lı varyasyon. (Veri 1992 Ocak'tan — Morningstar 11 ABD sektörü.)

---

## Tablo B.1 — Formation Period Sharpe Ratios (1974–2012, look-back ay)

| Varlık | 18 | 16 | 14 | **12** | 10 | 8 | 6 | 4 | 2 |
|--------|----|----|----|--------|----|----|---|---|---|
| MSCI US | 0.41 | 0.43 | 0.45 | **0.56** | 0.46 | 0.44 | 0.41 | 0.38 | 0.23 |
| EAFE | 0.33 | 0.32 | 0.35 | 0.41 | 0.45 | 0.32 | 0.38 | 0.36 | 0.46 |
| TBOND | 0.40 | 0.42 | 0.45 | **0.54** | 0.38 | 0.36 | 0.33 | 0.42 | 0.40 |
| CREDIT | 0.75 | 0.80 | 0.70 | 0.74 | 0.80 | 0.81 | 0.69 | 0.71 | 0.66 |
| HI YLD | 0.70 | 0.87 | 0.82 | **0.92** | 0.66 | 0.69 | 0.82 | 0.77 | 0.77 |
| REIT | 0.65 | 0.71 | 0.72 | 0.69 | 0.63 | 0.63 | 0.87 | 0.68 | 0.63 |
| GSCI | 0.04 | 0.04 | 0.09 | **0.20** | 0.09 | −0.08 | −0.11 | 0.13 | 0.06 |
| GOLD | 0.39 | 0.35 | 0.35 | **0.42** | 0.37 | 0.37 | 0.32 | 0.30 | 0.21 |

> En iyi Sharpe'lar **12 ayda kümeleniyor** (çoğu varlık için). 12 ay = benchmark formation period seçiminin gerekçesi.

---

## Özet: Doğrulama Hedefleri (kendi backtest için)

| Strateji | Dönem | Beklenen Yıllık Getiri | Beklenen Sharpe | Beklenen Max DD |
|----------|-------|------------------------|-----------------|------------------|
| **GEM** | 1974–2013 | ~17.4% | ~0.87 | ~−22.7% |
| S&P 500 Abs Mom | 1974–2013 | ~14.4% | ~0.69 | ~−29.6% |
| Relative Mom (ACWI) | 1974–2013 | ~14.4% | ~0.52 | ~−53.1% |
| GBM | 1974–2013 | ~16.0% | ~0.98 | ~−16.8% |
| DMSR | 1993–2013 | ~17.9% | ~1.13 | ~−17.2% |
