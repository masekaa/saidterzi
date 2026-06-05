# 09 — Python İmplementasyon Spesifikasyonu

> Kodlama temeli. GEM ve varyasyonlarını backtest edip uygulayacak modül planı, pseudo-code, edge-case'ler.
> Bu doküman kitabın kurallarını **kod yazılabilir** netliğe çevirir.

---

## 1. Mimari Genel Bakış

```
dual_momentum/
├── data/
│   ├── loaders.py        # veri çekme (yfinance / csv / index chaining)
│   └── chains.py         # tarihsel endeks zincirleme (ACWI<->World, Agg<->Gov&Credit)
├── core/
│   ├── momentum.py       # absolute/relative momentum hesapları
│   ├── signals.py        # GEM/GBM/DMSR sinyal üretimi
│   └── portfolio.py      # pozisyon → getiri serisi, rebalancing
├── metrics/
│   ├── performance.py    # CAGR, Sharpe, vol, %profit months
│   ├── drawdown.py       # max DD, drawdown tablosu
│   └── factors.py        # Fama-French-Carhart regresyon (opsiyonel)
├── backtest/
│   ├── engine.py         # ana backtest döngüsü
│   └── config.py         # parametre dataclass'ları
├── reporting/
│   ├── tables.py         # kitap formatında tablolar
│   └── charts.py         # cumulative growth, drawdown, scatter
└── tests/
    └── test_gem.py       # kitap rakamlarına karşı doğrulama
```

---

## 2. Konfigürasyon (Parametreler)

```python
from dataclasses import dataclass, field

@dataclass
class GEMConfig:
    lookback_months: int = 12
    rebalance: str = "M"                  # ay sonu (pandas 'M')
    return_type: str = "total_return"     # ZORUNLU: temettü/faiz dahil
    skip_month: bool = False              # endekslerde False
    abs_mom_threshold: str = "candidate_self"  # "candidate_self" | "sp500_always"
    risk_free: str = "TBILL_3M"
    transaction_cost_bps: float = 0.0     # opsiyonel; kitap GEM tablosunda ~0
    # Varlık sembolleri (ETF veya endeks)
    us_equity: str = "SP500_TR"
    intl_equity: str = "ACWI_EX_US"
    safe_bond: str = "AGG"

@dataclass
class DMSRConfig:
    lookback_months: int = 12
    top_n_sectors: int = 3                # ⚠️ kitapta net değil — parametre
    sectors: list = field(default_factory=lambda: [
        "technology","industrials","energy","communication_services",
        "real_estate","financial_services","consumer_cyclical",
        "basic_materials","utilities","consumer_defensive","healthcare"])
    safe_bond: str = "AGG"
    sector_weighting: str = "equal"
```

---

## 3. Momentum Çekirdek (core/momentum.py)

```python
def trailing_total_return(prices: pd.Series, months: int, skip_month: bool=False) -> pd.Series:
    """
    Son `months` aylık toplam getiri (total return endeksinden).
    prices: total-return endeks seviyesi (Adj Close benzeri), aylık (month-end).
    skip_month=True ise son ayı atla (bireysel hisseler için; GEM'de False).
    """
    if skip_month:
        # t-1 ile t-(months+1) arası
        return prices.shift(1) / prices.shift(months + 1) - 1.0
    else:
        return prices / prices.shift(months) - 1.0

def absolute_momentum(asset_ret_12m: pd.Series, tbill_ret_12m: pd.Series) -> pd.Series:
    """Excess return > 0 ise pozitif (True = long, False = exit)."""
    return (asset_ret_12m - tbill_ret_12m) > 0
```

> **KRİTİK:** Tüm getiriler **total return** (Adj Close). Price-only kullanmak absolute momentum eşiğini bozar (temettü kaybı). Aylık seviye = ay sonu (month-end) değerleri.

---

## 4. GEM Sinyal Üretimi (core/signals.py)

```python
def gem_signal(px: dict, cfg: GEMConfig) -> pd.Series:
    """
    px: {'us': Series, 'intl': Series, 'tbill': Series, 'bond': Series}
        hepsi month-end total-return seviyesi.
    Dönüş: her ay için pozisyon etiketi {'us','intl','bond'}.
    """
    L = cfg.lookback_months
    r_us   = trailing_total_return(px['us'],   L)
    r_intl = trailing_total_return(px['intl'], L)
    r_tb   = trailing_total_return(px['tbill'], L)

    pos = pd.Series(index=r_us.index, dtype=object)
    for t in r_us.index:
        if pd.isna(r_us[t]) or pd.isna(r_intl[t]) or pd.isna(r_tb[t]):
            continue
        # ADIM 1 — relative momentum (aday seçimi)
        if r_us[t] >= r_intl[t]:
            cand, r_cand = 'us', r_us[t]
        else:
            cand, r_cand = 'intl', r_intl[t]
        # ADIM 2 — absolute momentum (trend filtresi)
        if cfg.abs_mom_threshold == "sp500_always":
            r_for_abs = r_us[t]          # ikinci formülasyon
        else:
            r_for_abs = r_cand           # Figure 8.4 (varsayılan)
        pos[t] = cand if (r_for_abs > r_tb[t]) else 'bond'
    return pos.dropna()
```

### Edge-case'ler (sinyal):
- **Eşitlik (`r_us == r_intl`):** `>=` ile ABD'ye yön ver (varsayılan; kitap ABD-merkezli). Konfigüre edilebilir.
- **NaN / yetersiz geçmiş:** İlk 12 ay sinyal yok (warm-up). Backtest 12 ay sonra başlar.
- **abs_mom eşik seçimi:** Varsayılan `candidate_self` (Figure 8.4). `sp500_always` ikinci formülasyon — ikisi de raporlanmalı, fark analiz edilmeli (kitap ikisini de "aynı sonuç" der ama kenar durumlarda ayrışır).

---

## 5. Pozisyon → Getiri (core/portfolio.py)

```python
def positions_to_returns(pos: pd.Series, monthly_ret: dict,
                         tcost_bps: float = 0.0) -> pd.Series:
    """
    pos[t]: t ayı SONUNDA belirlenen, t+1 ayında TUTULACAK pozisyon.
    monthly_ret: {'us','intl','bond': aylık getiri serileri}
    Lookahead bias önlemi: t sonunda karar → t+1 getirisi uygulanır (shift).
    """
    held = pos.shift(1)   # t+1'de t-sonu kararını uygula
    ret = pd.Series(index=pos.index, dtype=float)
    prev = None
    for t in held.dropna().index:
        a = held[t]
        ret[t] = monthly_ret[a][t]
        if prev is not None and prev != a and tcost_bps:
            ret[t] -= tcost_bps / 10000.0   # geçişte işlem maliyeti
        prev = a
    return ret.dropna()
```

> **EN KRİTİK BUG KAYNAĞI — Lookahead bias:** Sinyal t ayının *sonundaki* 12-ay getirisiyle hesaplanır; getiri t+1 ayında gerçekleşir. `pos.shift(1)` ZORUNLU. Aksi halde geleceği görerek backtest şişer.

---

## 6. Metrikler (metrics/)

```python
def annual_return_arithmetic(monthly_ret):   # kitap aritmetik kullanıyor olabilir
    return monthly_ret.mean() * 12
def cagr(monthly_ret):
    n = len(monthly_ret)
    return (1 + monthly_ret).prod() ** (12/n) - 1
def annual_vol(monthly_ret):
    return monthly_ret.std(ddof=1) * (12 ** 0.5)
def sharpe(monthly_ret, rf_monthly):
    ex = monthly_ret - rf_monthly
    return (ex.mean() / ex.std(ddof=1)) * (12 ** 0.5)
def max_drawdown(monthly_ret):
    eq = (1 + monthly_ret).cumprod()
    peak = eq.cummax()
    dd = eq/peak - 1.0
    return dd.min()                # en negatif
def pct_profitable_months(monthly_ret):
    return (monthly_ret > 0).mean() * 100
```

> **Aritmetik vs Geometrik:** Kitap "Annual return" muhtemelen **aritmetik yıllık ortalama** (CAGR değil). Hem aritmetik hem CAGR raporla; doğrulamada hangisinin kitap rakamına uyduğunu belirle. (GEM aritmetik ~17.43 hedefi.)

### Drawdown tablosu (metrics/drawdown.py)
- En büyük N drawdown: amount, start (peak) date, low date, recovery date, peak-to-trough ay, trough-to-recovery ay, peak-to-recovery ay.

### Faktör regresyonu (metrics/factors.py)
- Kenneth French data library: Mkt-RF, SMB, HML, MOM (UMD) + risksiz oran.
- GEM için ek Bond faktörü (Barclays Agg excess return).
- Newey-West robust standart hatalar (statsmodels `cov_type='HAC', maxlags=...`).
- Çıktı: alpha (yıllık = aylık × 12), her faktör katsayısı + t-stat, R².

---

## 7. Backtest Motoru (backtest/engine.py)

```python
def run_gem(px, monthly_ret, rf_monthly, cfg: GEMConfig) -> dict:
    pos = gem_signal(px, cfg)
    ret = positions_to_returns(pos, monthly_ret, cfg.transaction_cost_bps)
    return {
        "positions": pos,
        "returns": ret,
        "annual_return": annual_return_arithmetic(ret),
        "cagr": cagr(ret),
        "vol": annual_vol(ret),
        "sharpe": sharpe(ret, rf_monthly.reindex(ret.index)),
        "max_dd": max_drawdown(ret),
        "pct_profit": pct_profitable_months(ret),
        "n_switches_per_year": count_switches(pos) / (len(pos)/12),
        "time_in_asset": pos.value_counts(normalize=True),
    }
```

---

## 8. Doğrulama Testleri (tests/test_gem.py)

Kitap rakamlarına karşı (`05-backtest-sonuclari.md`):

```python
EXPECTED_GEM_1974_2013 = {
    "annual_return": 17.43, "vol": 12.64, "sharpe": 0.87, "max_dd": -22.72,
    "time_us": 0.41, "time_intl": 0.29, "time_bond": 0.30,
    "switches_per_year": 1.35,
}
# Tolerans: veri/endeks-zincirleme farkları nedeniyle ±%1-2 sapma normal.
# Beklenti: yön ve büyüklük tutmalı (örn. Sharpe 0.8-0.95 aralığı).
```

Ayrıca doğrulanacak:
- S&P 500 Abs Mom → ~14.38 / 0.69 / −29.58
- GEM look-back 3/6/9/12 → monotonik Sharpe artışı (0.65→0.87)
- GEM 70 / GEM 130 → 0.90 / 0.81 Sharpe

---

## 9. Veri Katmanı Notları (data/)

### Tarihsel zincirleme (data/chains.py)
```
ACWI_EX_US:  1988-01+ MSCI ACWI ex-US  |  öncesi MSCI World ex-US
AGG:         1976-01+ Barclays US Agg   |  öncesi US Gov't & Credit
```

### Veri kaynağı seçenekleri
| Kaynak | Avantaj | Dezavantaj |
|--------|---------|------------|
| yfinance (ETF Adj Close) | Ücretsiz, total return | Sadece ~2003+ (ETF lansmanları), kısa geçmiş |
| Stooq / CSV | Ücretsiz | Total return garantisi yok |
| Bloomberg/Refinitiv | Tam endeks geçmişi 1974+ | Ücretli |
| French data library | Faktörler + market | Sadece faktör |

> **Uyarı (kitaptan):** 15 yıl gibi kısa veri **güvenilmez** (nonergodic piyasalar). En az birkaç on yıl / birden çok rejim olmalı. ETF verisiyle tam 1974 backtest'i mümkün değil → endeks proxy veya ücretli veri gerekir. Modern doğrulama için 2003+ ETF verisi "smoke test" olarak kullanılabilir ama kitap rakamlarıyla birebir karşılaştırılamaz.

---

## 10. Geliştirme / Robustluk Eklentileri (opsiyonel, dikkatli)

> Kitabın overfitting uyarısına SAYGIYLA — bunlar production değil, **robustluk analizi** içindir:

1. **Look-back ensemble:** 6/9/12 ay sinyallerinin oyçokluğu (whipsaw azaltma).
2. **Rebalance-günü çeşitlendirme:** Ay-sonu yerine 4 farklı haftaya bölünmüş tranche'ler (ThinkNewfound fragility eleştirisine karşı).
3. **Abs-mom eşik duyarlılığı:** `candidate_self` vs `sp500_always` fark analizi.
4. **İşlem maliyeti duyarlılığı:** 0 / 10 / 20 / 50 bps senaryoları.
5. **Walk-forward:** Tek parametre (look-back) olduğu için optimizasyon yok; ama out-of-sample dönem ayrımı raporlanmalı.

---

## 11. Kullanım Akışı (özet)

```python
cfg = GEMConfig()
px = load_total_return_levels(["SP500_TR","ACWI_EX_US","AGG","TBILL_3M"])
monthly_ret = {k: to_monthly_returns(v) for k,v in px.items()}
rf = monthly_ret["tbill"]
result = run_gem(px, monthly_ret, rf, cfg)
print_book_table(result)        # 05'teki formatta
plot_cumulative_growth(result)  # vs ACWI
assert_close(result, EXPECTED_GEM_1974_2013, tol=0.02)
```

---

## 12. Bilinen Riskler / Açık Spec Noktaları (kodlamadan önce karara bağlanacak)

| # | Belirsizlik | Karar gerekiyor |
|---|-------------|------------------|
| 1 | abs-mom eşiği: aday-self mi S&P500-always mı? | Varsayılan: candidate_self (Fig 8.4). İkisini de test et. |
| 2 | Annual return: aritmetik mi CAGR mi? | İkisini de raporla; kitap aritmetik kullanıyor olabilir. |
| 3 | DMSR top-N sektör sayısı | Kitapta yok → parametre (1/3/5 test). |
| 4 | Veri: tam 1974 geçmişi nereden? | Endeks proxy / ücretli veri vs ETF smoke-test. |
| 5 | Eşitlik durumunda yön | `>=` → ABD (varsayılan). |
| 6 | İşlem maliyeti | GEM tablosunda ~0; Appendix B 20bps/switch. Konfigüre. |
