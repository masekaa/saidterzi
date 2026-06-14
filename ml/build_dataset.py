"""Ham 60m barlardan ozellik + hedef matrisi kurar -> ml/data/bist_60m_dataset.csv

Hedef: H bar SONRAKI getirinin yonu (yukari/asagi) + gercek getiri.
  H=1 -> ~1 saat sonra,  H=2 -> ~2 saat sonra (60m barlarda).

ANTI-LOOK-AHEAD: ozellikler yalniz GECMIS barlardan; hedef yalniz GELECEK bardan.
Gun-ici tahmin: hedef ayni seans icinde olmali (gece bosluklarini tahmin etmeyiz)
-> t+H farkli bir gune denk gelirse o ornek atilir.

Kullanim:  python ml/build_dataset.py [interval] [H1,H2,...]
  ornek:    python ml/build_dataset.py 60m 1,2
"""
import sys
import numpy as np
import pandas as pd
from pathlib import Path

DATA = Path(__file__).parent / "data"


def rsi(close: pd.Series, n: int = 14) -> pd.Series:
    d = close.diff()
    up = d.clip(lower=0).rolling(n).mean()
    dn = (-d.clip(upper=0)).rolling(n).mean()
    rs = up / dn.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def features_for_ticker(g: pd.DataFrame, horizons) -> pd.DataFrame:
    g = g.sort_values("t").reset_index(drop=True).copy()
    c = g["c"]
    logret = np.log(c / c.shift(1))

    feat = pd.DataFrame(index=g.index)
    # Gecmis getiriler (momentum) — cesitli pencereler
    for k in (1, 2, 3, 6, 12, 24):
        feat[f"ret_{k}"] = np.log(c / c.shift(k))
    # Yuvarlanan oynaklik
    for k in (6, 12, 24):
        feat[f"vol_{k}"] = logret.rolling(k).std()
    # RSI
    feat["rsi_14"] = rsi(c, 14)
    # Yuvarlanan en yuksek/dusuge yakinlik
    for k in (12, 24):
        hi = c.rolling(k).max()
        lo = c.rolling(k).min()
        feat[f"toHi_{k}"] = c / hi - 1
        feat[f"toLo_{k}"] = c / lo - 1
    # Hareketli ortalama uzakligi
    for k in (6, 12, 24):
        feat[f"sma_gap_{k}"] = c / c.rolling(k).mean() - 1
    # Hacim oranlari
    v = g["v"].astype(float)
    feat["vol_ratio_12"] = v / v.rolling(12).mean()
    # Bar ici aralik (oynaklik vekili)
    feat["bar_range"] = (g["h"] - g["l"]) / c.replace(0, np.nan)

    # Zaman ozellikleri (gun-ici mevsimsellik)
    ist = pd.to_datetime(g["t"], unit="s", utc=True).dt.tz_convert("Europe/Istanbul")
    feat["hour"] = ist.dt.hour + ist.dt.minute / 60.0
    feat["dow"] = ist.dt.dayofweek.astype(float)
    day = ist.dt.date.astype(str)

    # Hedef(ler): H bar sonraki getiri (ayni gun icindeyse)
    for H in horizons:
        fwd = np.log(c.shift(-H) / c)
        same_day = day.values == day.shift(-H).values
        fwd = fwd.where(pd.Series(same_day, index=g.index))
        feat[f"y_ret_{H}"] = fwd
        feat[f"y_up_{H}"] = (fwd > 0).astype("float")
        feat.loc[fwd.isna(), f"y_up_{H}"] = np.nan

    feat.insert(0, "ticker", g["ticker"].values)
    feat.insert(1, "t", g["t"].values)
    return feat


def main():
    interval = sys.argv[1] if len(sys.argv) > 1 else "60m"
    horizons = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else "1,2").split(",")]

    src = DATA / f"bist_{interval}.csv"
    if not src.exists():
        print(f"Once veriyi cek: python ml/fetch_intraday.py {interval}  (yok: {src})")
        return
    raw = pd.read_csv(src)
    out = pd.concat(
        [features_for_ticker(g, horizons) for _, g in raw.groupby("ticker")],
        ignore_index=True,
    )
    # En az bir hedefi olan ve ozellikleri tam satirlar
    ycols = [c for c in out.columns if c.startswith("y_")]
    fcols = [c for c in out.columns if c not in ("ticker", "t") and not c.startswith("y_")]
    before = len(out)
    out = out.dropna(subset=fcols)
    out = out[out[[f"y_up_{H}" for H in horizons]].notna().any(axis=1)]

    path = DATA / f"bist_{interval}_dataset.csv"
    out.to_csv(path, index=False)
    print(f"Kaydedildi: {path}")
    print(f"  {len(out):,} ornek ({before - len(out):,} eksik atildi) | {len(fcols)} ozellik")
    for H in horizons:
        col = f"y_up_{H}"
        valid = out[col].dropna()
        print(f"  H={H}: {len(valid):,} etiketli | yukari orani %{valid.mean()*100:.1f}")


if __name__ == "__main__":
    main()
